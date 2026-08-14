// Road Trip — Table Controller
// Drop in the game table root (same object as AVsitter).
// Handles: seat roster, HUD rez + Experience handshake, one-game lock, HTTP-IN JSONP.
// Compile: Mono + Experience. HUD object must be in this prim's inventory.
// See Docs/SECOND_LIFE.md

integer AVSITTER_STAND = 90065;
integer AVSITTER_SITTER = 90070;

// Inventory object rezzed on sit (must match object name in table inventory).
string HUD_OBJECT_NAME = "RoadTrip HUD";

// Track link messages (RoadTrip_Track.lsl)
integer TRACK_CMD_EVENT = 91001;
integer TRACK_CMD_START = 91002;
integer TRACK_CMD_RESET = 91003;
integer TRACK_RSP_RESET_DONE = 91004;

integer MAX_SEATS = 4;
float STAND_GRACE_SEC = 15.0;
float CAP_RETRY_SEC = 6.0;
integer RESET_TIMEOUT_SEC = 6;

// Parallel seat lists (index = seat 0..3). Empty seat: NULL_KEY / ""
list gSeatAv = [];
list gHudObj = []; // per-seat HUD object keys (for targeted RT_DETACH)
list gSeatName = [];
list gActive = []; // TRUE/FALSE per seat

// One-game lock
// 0=idle 1=solo 2=lobby 3=match 4=resetting
integer MODE_IDLE = 0;
integer MODE_SOLO = 1;
integer MODE_LOBBY = 2;
integer MODE_MATCH = 3;
integer MODE_RESETTING = 4;
integer gMode = 0;
key gSoloUid = NULL_KEY;
key gHostUid = NULL_KEY;
string gRoomCode = "";
list gJoined = []; // avatar keys who joined current lobby/match

// Pending HTTP while Track resets (claim_solo / create / start)
key gPendingHttp = NULL_KEY;
string gPendingCb = "";
string gPendingAction = "";
key gPendingUid = NULL_KEY;
integer gResetDeadline = 0;
integer gPendingPlayers = 1;

// Stand grace: av keys waiting to clear
list gGraceAv = [];
list gGraceSeat = [];
list gGraceUntil = [];

string gCapUrl = "";
key gUrlReq = NULL_KEY;
integer gCapRetry = 0;
integer gReadyTick = 0;
integer DEBUG = FALSE;

// HUD rez handshake queue: stride [channel, avatar, seat]
list gRezQueue = [];
// Deferred RegionSayTo after object_rez: stride [hudKey, channel, message]
list gHudReadyQueue = [];

integer debug(string m)
{
    if (DEBUG) llOwnerSay("RT TABLE: " + m);
    return TRUE;
}

integer tableChannel()
{
    return (integer)("0x" + llGetSubString((string)llGetKey(), 0, 7)) * -1;
}

integer commandChannel(key av)
{
    return (integer)("0x" + llGetSubString((string)av, -8, -1)) * -1;
}

integer initSeats()
{
    gSeatAv = [NULL_KEY, NULL_KEY, NULL_KEY, NULL_KEY];
    gSeatName = ["", "", "", ""];
    gActive = [FALSE, FALSE, FALSE, FALSE];
    gHudObj = [NULL_KEY, NULL_KEY, NULL_KEY, NULL_KEY];
    return TRUE;
}

integer seatOf(key av)
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (llList2Key(gSeatAv, i) == av) return i;
    }
    return -1;
}

integer seatedCount()
{
    integer n = 0;
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (llList2Key(gSeatAv, i) != NULL_KEY) n++;
    }
    return n;
}

integer activeCount()
{
    integer n = 0;
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (llList2Integer(gActive, i) && llList2Key(gSeatAv, i) != NULL_KEY) n++;
    }
    return n;
}

integer isJoined(key av)
{
    return llListFindList(gJoined, [av]) >= 0;
}

integer clearGraceFor(key av)
{
    integer idx = llListFindList(gGraceAv, [av]);
    if (idx < 0) return FALSE;
    gGraceAv = llDeleteSubList(gGraceAv, idx, idx);
    gGraceSeat = llDeleteSubList(gGraceSeat, idx, idx);
    gGraceUntil = llDeleteSubList(gGraceUntil, idx, idx);
    return TRUE;
}

string jsonEscape(string s)
{
    s = llDumpList2String(llParseStringKeepNulls(s, ["\\"], []), "\\\\");
    s = llDumpList2String(llParseStringKeepNulls(s, ["\""], []), "\\\"");
    return llDumpList2String(llParseStringKeepNulls(s, ["\n"], []), "\\n");
}

string modeName()
{
    if (gMode == MODE_SOLO) return "solo";
    if (gMode == MODE_LOBBY) return "lobby";
    if (gMode == MODE_MATCH) return "match";
    if (gMode == MODE_RESETTING) return "resetting";
    return "idle";
}

clearPendingHttp()
{
    gPendingHttp = NULL_KEY;
    gPendingCb = "";
    gPendingAction = "";
    gPendingUid = NULL_KEY;
    gResetDeadline = 0;
}

integer beginTrackReset(integer clearLock)
{
    if (clearLock)
    {
        gSoloUid = NULL_KEY;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [];
    }
    gMode = MODE_RESETTING;
    gResetDeadline = llGetUnixTime() + RESET_TIMEOUT_SEC;
    llMessageLinked(LINK_SET, TRACK_CMD_RESET, "", NULL_KEY);
    debug("TRACK_CMD_RESET");
    return TRUE;
}

integer stashPending(key httpId, string cb, string action, key uid)
{
    gPendingHttp = httpId;
    gPendingCb = cb;
    gPendingAction = action;
    gPendingUid = uid;
    return TRUE;
}

string mintRoomCode()
{
    string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    string s = "";
    integer i;
    for (i = 0; i < 5; i++)
    {
        integer r = (integer)llFrand(llStringLength(alphabet));
        s += llGetSubString(alphabet, r, r);
    }
    return s;
}

integer sendHudDetach(key av, integer seat)
{
    string msg = "RT_DETACH|" + (string)llGetKey() + "|" + (string)av;
    if (av != NULL_KEY)
    {
        llRegionSayTo(av, commandChannel(av), msg);
        llRegionSay(tableChannel(), msg);
    }
    if (seat >= 0 && seat < MAX_SEATS)
    {
        key hud = llList2Key(gHudObj, seat);
        if (hud != NULL_KEY)
        {
            integer ch = 0;
            if (av != NULL_KEY) ch = commandChannel(av);
            llRegionSayTo(hud, ch, msg);
            gHudObj = llListReplaceList(gHudObj, [NULL_KEY], seat, seat);
        }
    }
    debug("RT_DETACH av=" + (string)av + " seat=" + (string)seat);
    return TRUE;
}

string readyMessage(key av, integer seat)
{
    if (av == NULL_KEY || seat < 0 || seat >= MAX_SEATS) return "";
    string name = llList2String(gSeatName, seat);
    string cap = gCapUrl;
    return "RT_READY|"
        + (string)llGetKey() + "|"
        + (string)seat + "|"
        + (string)av + "|"
        + cap + "|"
        + name;
}

string sendReady(key av, integer seat)
{
    string msg = readyMessage(av, seat);
    if (msg == "") return "";
    llRegionSayTo(av, commandChannel(av), msg);
    debug("RT_READY seat=" + (string)seat + " av=" + (string)av);
    return msg;
}

integer rezHudFor(key av, integer seat)
{
    if (av == NULL_KEY || seat < 0 || seat >= MAX_SEATS) return FALSE;
    if (llGetInventoryType(HUD_OBJECT_NAME) != INVENTORY_OBJECT)
    {
        llRegionSayTo(av, 0, "Road Trip: HUD object missing from table inventory (" + HUD_OBJECT_NAME + ").");
        llOwnerSay("CRITICAL: Put \"" + HUD_OBJECT_NAME + "\" in the table inventory (with RoadTrip_HUD.lsl inside it).");
        return FALSE;
    }
    integer ch = commandChannel(av);
    vector rezPos = llGetPos() + <0.0, 0.0, 1.5>;
    llRezObject(HUD_OBJECT_NAME, rezPos, ZERO_VECTOR, ZERO_ROTATION, ch);
    gRezQueue += [ch, av, seat];
    debug("rezzed HUD for seat=" + (string)seat);
    return TRUE;
}

integer queueHudReady(key hudId, integer ch, string msg)
{
    integer wasEmpty = (llGetListLength(gHudReadyQueue) == 0);
    gHudReadyQueue += [hudId, ch, msg];
    if (wasEmpty) llSetTimerEvent(0.35);
    return TRUE;
}

integer pumpHudReadyQueue()
{
    while (llGetListLength(gHudReadyQueue) >= 3)
    {
        key hudId = llList2Key(gHudReadyQueue, 0);
        integer ch = llList2Integer(gHudReadyQueue, 1);
        string msg = llList2String(gHudReadyQueue, 2);
        gHudReadyQueue = llDeleteSubList(gHudReadyQueue, 0, 2);
        llRegionSayTo(hudId, ch, msg);
        debug("handshake to HUD " + (string)hudId);
    }
    return TRUE;
}

integer announceAllSeated()
{
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        key av = llList2Key(gSeatAv, i);
        if (av != NULL_KEY) sendReady(av, i);
    }
    return TRUE;
}

integer releaseGameLock()
{
    // Clear lock and ask Track to reset; stay in resetting until TRACK_RSP_RESET_DONE.
    if (gMode == MODE_IDLE || gMode == MODE_RESETTING)
    {
        gSoloUid = NULL_KEY;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [];
        if (gMode == MODE_IDLE) return TRUE;
        return TRUE;
    }
    beginTrackReset(TRUE);
    return TRUE;
}

integer forfeitAvatar(key av)
{
    integer seat = seatOf(av);
    if (seat >= 0)
    {
        gActive = llListReplaceList(gActive, [FALSE], seat, seat);
    }
    integer j = llListFindList(gJoined, [av]);
    if (j >= 0) gJoined = llDeleteSubList(gJoined, j, j);

    if (gMode == MODE_SOLO && av == gSoloUid)
    {
        releaseGameLock();
        return TRUE;
    }
    if (gMode == MODE_LOBBY || gMode == MODE_MATCH)
    {
        if (av == gHostUid)
        {
            releaseGameLock();
            return TRUE;
        }
        if (gMode == MODE_MATCH && llGetListLength(gJoined) < 2)
        {
            releaseGameLock();
        }
    }
    return TRUE;
}

integer clearSeat(integer seat)
{
    if (seat < 0 || seat >= MAX_SEATS) return FALSE;
    key av = llList2Key(gSeatAv, seat);
    if (av != NULL_KEY)
    {
        sendHudDetach(av, seat);
        forfeitAvatar(av);
    }
    gSeatAv = llListReplaceList(gSeatAv, [NULL_KEY], seat, seat);
    gSeatName = llListReplaceList(gSeatName, [""], seat, seat);
    gActive = llListReplaceList(gActive, [FALSE], seat, seat);
    return TRUE;
}

integer onSit(key av, integer seat)
{
    if (seat < 0 || seat >= MAX_SEATS)
    {
        llRegionSayTo(av, 0, "Road Trip: invalid seat.");
        return FALSE;
    }
    clearGraceFor(av);

    integer prev = seatOf(av);
    key old = llList2Key(gSeatAv, seat);
    // Same seat again (AVsitter spam) — refresh READY only, do not rez another HUD.
    if (prev == seat && old == av)
    {
        sendReady(av, seat);
        key hud = NULL_KEY;
        if (seat >= 0 && seat < MAX_SEATS) hud = llList2Key(gHudObj, seat);
        if (hud == NULL_KEY)
        {
            rezHudFor(av, seat);
        }
        return TRUE;
    }

    // Vacate prior seat if hopping (sends RT_DETACH to old HUD).
    if (prev >= 0 && prev != seat) clearSeat(prev);
    // Kick previous occupant of target seat.
    if (old != NULL_KEY && old != av) clearSeat(seat);

    string nm = llGetDisplayName(av);
    if (nm == "") nm = llKey2Name(av);
    gSeatAv = llListReplaceList(gSeatAv, [av], seat, seat);
    gSeatName = llListReplaceList(gSeatName, [nm], seat, seat);
    gActive = llListReplaceList(gActive, [FALSE], seat, seat);

    rezHudFor(av, seat);
    llRegionSayTo(av, 0, "Road Trip: HUD attaching — click Enter Table when media loads.");
    return TRUE;
}

integer beginStandGrace(key av, integer seat)
{
    clearGraceFor(av);
    gGraceAv += [av];
    gGraceSeat += [seat];
    gGraceUntil += [llGetUnixTime() + (integer)STAND_GRACE_SEC];
    return TRUE;
}

integer processGrace()
{
    integer now = llGetUnixTime();
    integer i = 0;
    while (i < llGetListLength(gGraceAv))
    {
        if (llList2Integer(gGraceUntil, i) <= now)
        {
            key av = llList2Key(gGraceAv, i);
            integer seat = llList2Integer(gGraceSeat, i);
            gGraceAv = llDeleteSubList(gGraceAv, i, i);
            gGraceSeat = llDeleteSubList(gGraceSeat, i, i);
            gGraceUntil = llDeleteSubList(gGraceUntil, i, i);
            if (seatOf(av) == seat) clearSeat(seat);
        }
        else
        {
            i++;
        }
    }
    return TRUE;
}

list parseQuery(string qs)
{
    list out = [];
    list pairs = llParseString2List(qs, ["&"], []);
    integer i;
    integer n = llGetListLength(pairs);
    for (i = 0; i < n; i++)
    {
        string pair = llList2String(pairs, i);
        integer eq = llSubStringIndex(pair, "=");
        if (eq >= 0)
        {
            out += [
                llUnescapeURL(llGetSubString(pair, 0, eq - 1)),
                llUnescapeURL(llGetSubString(pair, eq + 1, -1))
            ];
        }
    }
    return out;
}

string qget(list params, string name)
{
    integer idx = llListFindList(params, [name]);
    if (idx < 0) return "";
    return llList2String(params, idx + 1);
}

integer cbOk(string cb)
{
    if (cb == "" || llStringLength(cb) > 64) return FALSE;
    return TRUE;
}

sendJsonp(key httpId, string callback, string json)
{
    if (httpId == NULL_KEY) return;
    if (!cbOk(callback))
    {
        llSetContentType(httpId, CONTENT_TYPE_TEXT);
        llHTTPResponse(httpId, 400, "{\"ok\":false}");
        return;
    }
    llSetContentType(httpId, CONTENT_TYPE_TEXT);
    llHTTPResponse(httpId, 200, callback + "(" + json + ");");
}

string rosterJson()
{
    string s = "[";
    integer i;
    integer first = TRUE;
    for (i = 0; i < MAX_SEATS; i++)
    {
        key av = llList2Key(gSeatAv, i);
        if (av == NULL_KEY) jump cont;
        if (!first) s += ",";
        first = FALSE;
        s += "{"
            + "\"seat\":" + (string)i + ","
            + "\"uid\":\"" + (string)av + "\","
            + "\"name\":\"" + jsonEscape(llList2String(gSeatName, i)) + "\","
            + "\"active\":" + llList2String(["false", "true"], llList2Integer(gActive, i)) + ","
            + "\"joined\":" + llList2String(["false", "true"], isJoined(av))
            + "}";
        @cont;
    }
    s += "]";
    return s;
}

string statusJson(integer ok, string err)
{
    string j = "{"
        + "\"ok\":" + llList2String(["false", "true"], ok) + ","
        + "\"tableId\":\"" + (string)llGetKey() + "\","
        + "\"mode\":\"" + modeName() + "\","
        + "\"activeCount\":" + (string)activeCount() + ","
        + "\"seatedCount\":" + (string)seatedCount() + ","
        + "\"roomCode\":\"" + jsonEscape(gRoomCode) + "\","
        + "\"hostUid\":\"" + (string)gHostUid + "\","
        + "\"soloUid\":\"" + (string)gSoloUid + "\","
        + "\"roster\":" + rosterJson();
    if (err != "") j += ",\"error\":\"" + jsonEscape(err) + "\"";
    j += "}";
    return j;
}

// Seat UUID pipe for Track START (empty field = vacant / AI lane).
string seatUidPipe()
{
    string s = "";
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        if (i) s += "|";
        key av = llList2Key(gSeatAv, i);
        if (av != NULL_KEY) s += (string)av;
    }
    return s;
}

string matchStartPayload()
{
    // Only joined humans count as match seats.
    string s = "match";
    integer i;
    for (i = 0; i < MAX_SEATS; i++)
    {
        s += "|";
        key av = llList2Key(gSeatAv, i);
        if (av != NULL_KEY && llListFindList(gJoined, [av]) >= 0) s += (string)av;
    }
    return s;
}

string soloStartPayload(key human, integer nPlayers)
{
    integer humanSeat = seatOf(human);
    if (humanSeat < 0) humanSeat = 0;
    if (nPlayers < 1) nPlayers = 1;
    if (nPlayers > MAX_SEATS) nPlayers = MAX_SEATS;
    return "solo|" + (string)nPlayers + "|" + (string)humanSeat + "|" + seatUidPipe();
}

integer finishReset()
{
    string action = gPendingAction;
    key httpId = gPendingHttp;
    string cb = gPendingCb;
    key uid = gPendingUid;
    clearPendingHttp();

    if (action == "claim_solo")
    {
        gMode = MODE_SOLO;
        gSoloUid = uid;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [uid];
        string startMsg = soloStartPayload(uid, gPendingPlayers);
        llMessageLinked(LINK_SET, TRACK_CMD_START, startMsg, NULL_KEY);
        debug("TRACK_CMD_START (solo) " + startMsg);
        gPendingPlayers = 1;
        if (httpId != NULL_KEY) sendJsonp(httpId, cb, statusJson(TRUE, ""));
        return TRUE;
    }
    if (action == "create")
    {
        gMode = MODE_LOBBY;
        gHostUid = uid;
        gSoloUid = NULL_KEY;
        gRoomCode = mintRoomCode();
        gJoined = [uid];
        if (httpId != NULL_KEY) sendJsonp(httpId, cb, statusJson(TRUE, ""));
        return TRUE;
    }
    if (action == "start")
    {
        gMode = MODE_MATCH;
        string startMsg = matchStartPayload();
        llMessageLinked(LINK_SET, TRACK_CMD_START, startMsg, NULL_KEY);
        debug("TRACK_CMD_START (match) " + startMsg);
        if (httpId != NULL_KEY) sendJsonp(httpId, cb, statusJson(TRUE, ""));
        return TRUE;
    }

    // end_game / forfeit reset complete
    gMode = MODE_IDLE;
    gSoloUid = NULL_KEY;
    gHostUid = NULL_KEY;
    gRoomCode = "";
    gJoined = [];
    return TRUE;
}

integer requireSeatedActive(key uid, integer seatHint)
{
    integer seat = seatOf(uid);
    if (seat < 0) return -1;
    if (seatHint >= 0 && seatHint != seat) return -2;
    if (!llList2Integer(gActive, seat)) return -3;
    return seat;
}

handleHttp(key id, string method, string body, string query)
{
    list q = parseQuery(query);
    string action = qget(q, "action");
    string cb = qget(q, "cb");
    key uid = (key)qget(q, "uid");
    string pname = qget(q, "name");
    integer seatHint = (integer)qget(q, "seat");
    if (qget(q, "seat") == "") seatHint = -1;

    if (action == "" || action == "status")
    {
        sendJsonp(id, cb, statusJson(TRUE, ""));
        return;
    }

    if (uid == NULL_KEY)
    {
        sendJsonp(id, cb, statusJson(FALSE, "uid required"));
        return;
    }

    if (action == "enter")
    {
        integer seat = seatOf(uid);
        if (seat < 0)
        {
            sendJsonp(id, cb, statusJson(FALSE, "not seated"));
            return;
        }
        if (pname != "") gSeatName = llListReplaceList(gSeatName, [pname], seat, seat);
        gActive = llListReplaceList(gActive, [TRUE], seat, seat);
        sendJsonp(id, cb, statusJson(TRUE, ""));
        return;
    }

    if (action == "leave")
    {
        forfeitAvatar(uid);
        sendJsonp(id, cb, statusJson(TRUE, ""));
        return;
    }

    if (action == "claim_solo")
    {
        integer seat = requireSeatedActive(uid, seatHint);
        if (seat < 0)
        {
            sendJsonp(id, cb, statusJson(FALSE, "must be seated and active"));
            return;
        }
        if (gMode == MODE_RESETTING)
        {
            sendJsonp(id, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (gMode != MODE_IDLE)
        {
            sendJsonp(id, cb, statusJson(FALSE, "table busy"));
            return;
        }
        if (activeCount() > 1)
        {
            sendJsonp(id, cb, statusJson(FALSE, "other players are active — use multiplayer"));
            return;
        }
        integer nPlayers = (integer)qget(q, "players");
        if (nPlayers < 1) nPlayers = 1;
        if (nPlayers > MAX_SEATS) nPlayers = MAX_SEATS;
        gPendingPlayers = nPlayers;
        stashPending(id, cb, "claim_solo", uid);
        beginTrackReset(FALSE);
        return;
    }

    if (action == "end_game")
    {
        if (gMode == MODE_RESETTING)
        {
            sendJsonp(id, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (gMode == MODE_SOLO && uid != gSoloUid)
        {
            sendJsonp(id, cb, statusJson(FALSE, "not solo player"));
            return;
        }
        if ((gMode == MODE_LOBBY || gMode == MODE_MATCH) && uid != gHostUid && !isJoined(uid))
        {
            // joined player leaving match
            forfeitAvatar(uid);
            sendJsonp(id, cb, statusJson(TRUE, ""));
            return;
        }
        if (gMode == MODE_LOBBY || gMode == MODE_MATCH)
        {
            if (uid == gHostUid) releaseGameLock();
            else forfeitAvatar(uid);
        }
        else
        {
            releaseGameLock();
        }
        sendJsonp(id, cb, statusJson(TRUE, ""));
        return;
    }

    if (action == "create")
    {
        integer seat = requireSeatedActive(uid, seatHint);
        if (seat < 0)
        {
            sendJsonp(id, cb, statusJson(FALSE, "must be seated and active"));
            return;
        }
        if (gMode == MODE_RESETTING)
        {
            sendJsonp(id, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (gMode != MODE_IDLE)
        {
            sendJsonp(id, cb, statusJson(FALSE, "table busy"));
            return;
        }
        if (activeCount() < 2)
        {
            sendJsonp(id, cb, statusJson(FALSE, "need 2+ active players"));
            return;
        }
        stashPending(id, cb, "create", uid);
        beginTrackReset(FALSE);
        return;
    }

    if (action == "join")
    {
        integer seat = requireSeatedActive(uid, seatHint);
        if (seat < 0)
        {
            sendJsonp(id, cb, statusJson(FALSE, "must be seated and active"));
            return;
        }
        if (gMode != MODE_LOBBY)
        {
            sendJsonp(id, cb, statusJson(FALSE, "no open lobby"));
            return;
        }
        if (!isJoined(uid))
        {
            if (llGetListLength(gJoined) >= MAX_SEATS)
            {
                sendJsonp(id, cb, statusJson(FALSE, "lobby full"));
                return;
            }
            gJoined += [uid];
        }
        sendJsonp(id, cb, statusJson(TRUE, ""));
        return;
    }

    if (action == "start")
    {
        if (gMode == MODE_RESETTING)
        {
            sendJsonp(id, cb, statusJson(FALSE, "table resetting"));
            return;
        }
        if (uid != gHostUid)
        {
            sendJsonp(id, cb, statusJson(FALSE, "only host can start"));
            return;
        }
        if (gMode != MODE_LOBBY)
        {
            sendJsonp(id, cb, statusJson(FALSE, "not in lobby"));
            return;
        }
        if (llGetListLength(gJoined) < 2)
        {
            sendJsonp(id, cb, statusJson(FALSE, "need at least 2 joined"));
            return;
        }
        stashPending(id, cb, "start", uid);
        beginTrackReset(FALSE);
        return;
    }

    // Pipe game events → Track (solo player or MP host only)
    if (action == "event")
    {
        string payload = qget(q, "p");
        if (payload == "")
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"missing p\"}");
            return;
        }
        if (gMode == MODE_RESETTING)
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"table resetting\"}");
            return;
        }
        if (gMode == MODE_SOLO)
        {
            if (uid != gSoloUid)
            {
                sendJsonp(id, cb, "{\"ok\":false,\"error\":\"only solo player emits\"}");
                return;
            }
        }
        else if (gMode == MODE_MATCH)
        {
            if (uid != gHostUid)
            {
                sendJsonp(id, cb, "{\"ok\":false,\"error\":\"only host emits\"}");
                return;
            }
        }
        else
        {
            sendJsonp(id, cb, "{\"ok\":false,\"error\":\"no active match\"}");
            return;
        }
        llMessageLinked(LINK_SET, TRACK_CMD_EVENT, payload, NULL_KEY);
        sendJsonp(id, cb, "{\"ok\":true}");
        return;
    }

    sendJsonp(id, cb, statusJson(FALSE, "unknown action"));
}

requestCap()
{
    gUrlReq = llRequestSecureURL();
}

default
{
    state_entry()
    {
        initSeats();
        clearPendingHttp();
        gMode = MODE_IDLE;
        gSoloUid = NULL_KEY;
        gHostUid = NULL_KEY;
        gRoomCode = "";
        gJoined = [];
        llListen(tableChannel(), "", NULL_KEY, "");
        requestCap();
        llSetTimerEvent(2.0);
        llOwnerSay("Road Trip table ready. Key=" + (string)llGetKey());
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_REGION_START)
        {
            requestCap();
        }
        // Do not reset on CHANGED_INVENTORY — drops HTTP-IN.
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == TRACK_RSP_RESET_DONE)
        {
            if (gMode == MODE_RESETTING) finishReset();
            return;
        }
        if (num == AVSITTER_SITTER)
        {
            integer seat = (integer)str;
            onSit(id, seat);
            return;
        }
        if (num == AVSITTER_STAND)
        {
            key av = id;
            integer seat = -1;
            if (av != NULL_KEY) seat = seatOf(av);
            if (seat < 0)
            {
                key fromStr = (key)str;
                if (fromStr != NULL_KEY)
                {
                    av = fromStr;
                    seat = seatOf(av);
                }
            }
            if (seat < 0)
            {
                integer s = (integer)str;
                if (s >= 0 && s < MAX_SEATS)
                {
                    seat = s;
                    if (av == NULL_KEY) av = llList2Key(gSeatAv, seat);
                }
            }
            sendHudDetach(av, seat);
            beginStandGrace(av, seat);
            return;
        }
    }

    object_rez(key objId)
    {
        if (llGetListLength(gRezQueue) < 3) return;
        integer ch = llList2Integer(gRezQueue, 0);
        key av = llList2Key(gRezQueue, 1);
        integer seat = llList2Integer(gRezQueue, 2);
        gRezQueue = llDeleteSubList(gRezQueue, 0, 2);
        string msg = readyMessage(av, seat);
        if (msg == "") return;
        queueHudReady(objId, ch, msg);
        if (seat >= 0 && seat < MAX_SEATS)
        {
            gHudObj = llListReplaceList(gHudObj, [objId], seat, seat);
        }
    }

    listen(integer channel, string name, key id, string msg)
    {
        if (channel != tableChannel()) return;
        // RT_HELLO|uid  from HUD LSL
        if (llGetSubString(msg, 0, 7) != "RT_HELLO") return;
        list parts = llParseStringKeepNulls(msg, ["|"], []);
        key uid = (key)llList2String(parts, 1);
        if (uid == NULL_KEY) uid = id;
        // Only accept from the wearer's attachments: id is object key; verify uid is seated
        integer seat = seatOf(uid);
        if (seat < 0) return;
        sendReady(uid, seat);
    }

    http_request(key id, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            gCapUrl = body;
            gCapRetry = 0;
            debug("HTTP-IN " + gCapUrl);
            announceAllSeated();
            return;
        }
        if (method == URL_REQUEST_DENIED)
        {
            gCapUrl = "";
            gCapRetry++;
            debug("HTTP-IN denied; retry " + (string)gCapRetry);
            return;
        }
        string query = llGetHTTPHeader(id, "x-query-string");
        // Also support path?query style
        string path = llGetHTTPHeader(id, "x-path-info");
        if (query == "" && llSubStringIndex(body, "action=") == 0) query = body;
        handleHttp(id, method, body, query);
    }

    timer()
    {
        pumpHudReadyQueue();
        // Keep a steady timer once handshake queue drains.
        if (llGetListLength(gHudReadyQueue) == 0) llSetTimerEvent(2.0);

        processGrace();
        if (gMode == MODE_RESETTING && gResetDeadline > 0)
        {
            if (llGetUnixTime() >= gResetDeadline)
            {
                debug("reset timeout — finishing");
                finishReset();
            }
        }
        gReadyTick++;
        // Occasional READY refresh (cap/seat changes) — not every few seconds.
        // ~60s at 2s timer tick.
        if (gReadyTick >= 30)
        {
            gReadyTick = 0;
            announceAllSeated();
        }
        if (gCapUrl == "" && gCapRetry < 8)
        {
            integer t = llGetUnixTime();
            if ((t % (integer)CAP_RETRY_SEC) == 0) requestCap();
        }
    }
}
