// Road Trip — Screens (faces, attract, sticky idle, splash)
// Drop in the SAME prim as RoadTrip_Track.lsl (textures live here).
// Compile: Mono. See Docs/SECOND_LIFE.md
//
// Track → Screens: SCR_CMD = 91101  str = pipe command
// Screens → Track: SCR_RSP = 91102  str = READY | GAMEOVER_DONE
//
// Commands:
//   RESET
//   ATTRACT|start | ATTRACT|stop
//   MATCH|0|1|1|0          (seat 1–4 in-match flags)
//   TURN|seat               (1–4; 0 = none)
//   SPLASH                  (hold ~3s then paint TURN/idle)
//   FACE|seat|slug
//   PLAY|seat|CARD|value    (self miles/remedy/safety flash + sticky)
//   HIT|seat|CARD           (hazard hit sticky on victim)
//   PLAYHAZARD|seat|CARD    (attacker play splash)
//   MILES|seat|n
//   GAMEOVER|1st|2nd|3rd|4th
//   GAMEOVER|1st|2nd|3rd|4th|PLACES|p1|p2|p3|p4

integer SCR_CMD = 91101;
integer SCR_RSP = 91102;

integer MAX_LANES = 4;
float ATTRACT_SEC = 6.0;
float GAME_OVER_HOLD_SEC = 5.0;
float SPLASH_HOLD_SEC = 3.0;

integer TIMER_OFF = 0;
integer TIMER_ATTRACT = 1;
integer TIMER_GAME_OVER = 2;
integer TIMER_SPLASH_HOLD = 3;

integer gScreensLink = 0;
list gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
list gStickyHazard = ["", "", "", ""];
list gStickyLimit = ["", "", "", ""];
list gStickyMoving = ["", "", "", ""];
list gSeatMiles = [0, 0, 0, 0];

integer gAttractSet = 0;
integer gTimerMode = 0;
integer gPendingTurnPlayer = 0;
integer gCurrentTurnPlayer = 0;
integer DEBUG = FALSE;

integer debug(string m)
{
    if (DEBUG) llOwnerSay("RT SCREENS: " + m);
    return TRUE;
}

key textureFor(string invName)
{
    if (invName == "") invName = "dummy-placeholder";
    key k = llGetInventoryKey(invName);
    if (k != NULL_KEY) return k;
    k = llGetInventoryKey("v4_" + invName);
    if (k != NULL_KEY) return k;
    k = llGetInventoryKey("dummy-placeholder");
    if (k != NULL_KEY) return k;
    k = llGetInventoryKey("v4_dummy-placeholder");
    if (k != NULL_KEY) return k;
    debug("missing texture: " + invName);
    return NULL_KEY;
}

reportMissingTextures()
{
    list need = [
        "attract-panorama-a1", "attract-panorama-a2", "attract-panorama-a3", "attract-panorama-a4",
        "attract-panorama-b1", "attract-panorama-b2", "attract-panorama-b3", "attract-panorama-b4",
        "dummy-placeholder", "status-your-turn", "status-waiting", "status-thinking",
        "end-winner", "end-2nd-place", "end-3rd-place", "end-4th-place",
        "end-game-over", "status-match-start",
        "miles-25", "miles-50", "miles-75", "miles-100", "miles-200",
        "remedy-go", "remedy-repairs", "remedy-gasoline", "remedy-spare-tire",
        "remedy-end-limit", "remedy-traffic-clear", "remedy-nav-fix",
        "safety-emergency-vehicle", "safety-driving-ace", "safety-extra-tank",
        "safety-puncture-proof", "safety-fast-lane", "safety-gps-lock",
        "hazard-hit-red-light", "hazard-hit-accident", "hazard-hit-out-of-gas",
        "hazard-hit-flat-tire", "hazard-hit-speed-limit", "hazard-hit-traffic-jam",
        "hazard-hit-gps-error",
        "hazard-play-red-light", "hazard-play-accident", "hazard-play-out-of-gas",
        "hazard-play-flat-tire", "hazard-play-speed-limit", "hazard-play-traffic-jam",
        "hazard-play-gps-error"
    ];
    integer i;
    integer missing = 0;
    integer n = llGetListLength(need);
    for (i = 0; i < n; i++)
    {
        string nm = llList2String(need, i);
        if (textureFor(nm) == NULL_KEY)
        {
            missing++;
            if (missing <= 8) llOwnerSay("RT SCREENS missing texture: " + nm);
        }
    }
    if (missing > 8) llOwnerSay("RT SCREENS … and " + (string)(missing - 8) + " more missing.");
    if (missing == 0) llOwnerSay("RT SCREENS: all " + (string)n + " screen textures found.");
}

integer indexScreensLink()
{
    integer n = llGetNumberOfPrims();
    integer i;
    gScreensLink = 0;
    for (i = 1; i <= n; i++)
    {
        if (llGetLinkName(i) == "screens") gScreensLink = i;
    }
    debug("screens link=" + (string)gScreensLink);
    return TRUE;
}

setFaceTexture(integer playerNum, string texKey)
{
    if (gScreensLink < 1) return;
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    llSetLinkTexture(gScreensLink, textureFor(texKey), playerNum - 1);
}

string milesKey(integer value)
{
    if (value == 25) return "miles-25";
    if (value == 50) return "miles-50";
    if (value == 75) return "miles-75";
    if (value == 100) return "miles-100";
    if (value == 200) return "miles-200";
    return "miles-25";
}

string hazardHitKey(string card)
{
    if (card == "STOP" || card == "RED_LIGHT" || card == "HIT_STOP") return "hazard-hit-red-light";
    if (card == "CRASH" || card == "ACCIDENT" || card == "HIT_CRASH") return "hazard-hit-accident";
    if (card == "GAS" || card == "OUT_OF_GAS" || card == "HIT_GAS") return "hazard-hit-out-of-gas";
    if (card == "FLAT" || card == "FLAT_TIRE" || card == "HIT_FLAT") return "hazard-hit-flat-tire";
    if (card == "LIMIT" || card == "SPEED_LIMIT" || card == "HIT_LIMIT") return "hazard-hit-speed-limit";
    if (card == "JAM" || card == "TRAFFIC_JAM" || card == "HIT_JAM") return "hazard-hit-traffic-jam";
    if (card == "GPS" || card == "GPS_ERROR" || card == "HIT_GPS") return "hazard-hit-gps-error";
    return "hazard-hit-red-light";
}

string hazardPlayKey(string card)
{
    if (card == "STOP" || card == "RED_LIGHT" || card == "PLAY_STOP") return "hazard-play-red-light";
    if (card == "CRASH" || card == "ACCIDENT" || card == "PLAY_CRASH") return "hazard-play-accident";
    if (card == "GAS" || card == "OUT_OF_GAS" || card == "PLAY_GAS") return "hazard-play-out-of-gas";
    if (card == "FLAT" || card == "FLAT_TIRE" || card == "PLAY_FLAT") return "hazard-play-flat-tire";
    if (card == "LIMIT" || card == "SPEED_LIMIT" || card == "PLAY_LIMIT") return "hazard-play-speed-limit";
    if (card == "JAM" || card == "TRAFFIC_JAM" || card == "PLAY_JAM") return "hazard-play-traffic-jam";
    if (card == "GPS" || card == "GPS_ERROR" || card == "PLAY_GPS") return "hazard-play-gps-error";
    return "hazard-play-red-light";
}

string remedyKey(string card)
{
    if (card == "GO" || card == "DRIVE") return "remedy-go";
    if (card == "REPAIRS" || card == "FIX") return "remedy-repairs";
    if (card == "GASOLINE" || card == "FUEL") return "remedy-gasoline";
    if (card == "SPARE_TIRE" || card == "SPARE") return "remedy-spare-tire";
    if (card == "END_LIMIT" || card == "END" || card == "END_OF_LIMIT") return "remedy-end-limit";
    if (card == "TRAFFIC_CLEAR" || card == "CLEAR") return "remedy-traffic-clear";
    if (card == "NAV_FIX" || card == "NAV" || card == "NAVIGATION_FIX") return "remedy-nav-fix";
    return "remedy-go";
}

string safetyKey(string card)
{
    if (card == "EV" || card == "EMERGENCY_VEHICLE") return "safety-emergency-vehicle";
    if (card == "ACE" || card == "DRIVING_ACE") return "safety-driving-ace";
    if (card == "TANK" || card == "EXTRA_TANK") return "safety-extra-tank";
    if (card == "TIRES" || card == "PUNCTURE_PROOF" || card == "PUNCTURE-PROOF") return "safety-puncture-proof";
    if (card == "HOV" || card == "FAST_LANE") return "safety-fast-lane";
    if (card == "LOCK" || card == "GPS_LOCK") return "safety-gps-lock";
    return "safety-emergency-vehicle";
}

string selfPlayKey(string card, integer value)
{
    if (card == "DISTANCE" || card == "MILES" || card == "MILEAGE") return milesKey(value);
    if (card == "25" || card == "MILES25" || card == "MILES_25") return "miles-25";
    if (card == "50" || card == "MILES50" || card == "MILES_50") return "miles-50";
    if (card == "75" || card == "MILES75" || card == "MILES_75") return "miles-75";
    if (card == "100" || card == "MILES100" || card == "MILES_100") return "miles-100";
    if (card == "200" || card == "MILES200" || card == "MILES_200") return "miles-200";
    if (card == "GO" || card == "DRIVE" || card == "REPAIRS" || card == "FIX"
        || card == "GASOLINE" || card == "FUEL" || card == "SPARE_TIRE" || card == "SPARE"
        || card == "END_LIMIT" || card == "END" || card == "END_OF_LIMIT"
        || card == "TRAFFIC_CLEAR" || card == "CLEAR"
        || card == "NAV_FIX" || card == "NAV" || card == "NAVIGATION_FIX")
    {
        return remedyKey(card);
    }
    if (card == "EV" || card == "EMERGENCY_VEHICLE" || card == "ACE" || card == "DRIVING_ACE"
        || card == "TANK" || card == "EXTRA_TANK" || card == "TIRES" || card == "PUNCTURE_PROOF"
        || card == "PUNCTURE-PROOF" || card == "HOV" || card == "FAST_LANE"
        || card == "LOCK" || card == "GPS_LOCK")
    {
        return safetyKey(card);
    }
    return "dummy-placeholder";
}

integer isSpeedLimitCard(string card)
{
    return card == "LIMIT" || card == "SPEED_LIMIT" || card == "HIT_LIMIT" || card == "PLAY_LIMIT";
}

integer isEndLimitCard(string card)
{
    return card == "END_LIMIT" || card == "END" || card == "END_OF_LIMIT";
}

integer isBattleRemedyCard(string card)
{
    if (card == "GO" || card == "DRIVE") return TRUE;
    if (card == "REPAIRS" || card == "FIX") return TRUE;
    if (card == "GASOLINE" || card == "FUEL") return TRUE;
    if (card == "SPARE_TIRE" || card == "SPARE") return TRUE;
    if (card == "TRAFFIC_CLEAR" || card == "CLEAR") return TRUE;
    if (card == "NAV_FIX" || card == "NAV" || card == "NAVIGATION_FIX") return TRUE;
    return FALSE;
}

integer isEmergencyVehicleCard(string card)
{
    return card == "EV" || card == "EMERGENCY_VEHICLE";
}

string idleScreenForSeat(integer playerNum)
{
    integer idx = playerNum - 1;
    string hazard = llList2String(gStickyHazard, idx);
    if (hazard != "") return hazard;
    string lim = llList2String(gStickyLimit, idx);
    if (lim != "") return lim;
    if (llList2Integer(gSeatMiles, idx) > 0)
    {
        string moving = llList2String(gStickyMoving, idx);
        if (moving != "") return moving;
        return "remedy-go";
    }
    return "status-waiting";
}

setStickyHazard(integer playerNum, string tex)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    gStickyHazard = llListReplaceList(gStickyHazard, [tex], playerNum - 1, playerNum - 1);
}

setStickyLimit(integer playerNum, string tex)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    gStickyLimit = llListReplaceList(gStickyLimit, [tex], playerNum - 1, playerNum - 1);
}

setStickyMoving(integer playerNum, string tex)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    if (tex == "") return;
    gStickyMoving = llListReplaceList(gStickyMoving, [tex], playerNum - 1, playerNum - 1);
}

clearStickyHazard(integer playerNum)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    gStickyHazard = llListReplaceList(gStickyHazard, [""], playerNum - 1, playerNum - 1);
}

clearStickyLimit(integer playerNum)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    gStickyLimit = llListReplaceList(gStickyLimit, [""], playerNum - 1, playerNum - 1);
}

setSeatMiles(integer playerNum, integer miles)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    if (miles < 0) miles = 0;
    gSeatMiles = llListReplaceList(gSeatMiles, [miles], playerNum - 1, playerNum - 1);
}

clearStickiesAfterSelfPlay(integer playerNum, string card)
{
    if (isEndLimitCard(card))
    {
        clearStickyLimit(playerNum);
        return;
    }
    if (isBattleRemedyCard(card))
    {
        clearStickyHazard(playerNum);
        setStickyMoving(playerNum, remedyKey(card));
        return;
    }
    if (isEmergencyVehicleCard(card))
    {
        clearStickyHazard(playerNum);
        clearStickyLimit(playerNum);
        setStickyMoving(playerNum, safetyKey(card));
        return;
    }
    if (card == "ACE" || card == "DRIVING_ACE" || card == "TANK" || card == "EXTRA_TANK"
        || card == "TIRES" || card == "PUNCTURE_PROOF" || card == "PUNCTURE-PROOF"
        || card == "HOV" || card == "FAST_LANE" || card == "LOCK" || card == "GPS_LOCK")
    {
        clearStickyHazard(playerNum);
        setStickyMoving(playerNum, safetyKey(card));
    }
}

applyAttractSet()
{
    if (gAttractSet == 0)
    {
        setFaceTexture(1, "attract-panorama-a1");
        setFaceTexture(2, "attract-panorama-a2");
        setFaceTexture(3, "attract-panorama-a3");
        setFaceTexture(4, "attract-panorama-a4");
    }
    else
    {
        setFaceTexture(1, "attract-panorama-b1");
        setFaceTexture(2, "attract-panorama-b2");
        setFaceTexture(3, "attract-panorama-b3");
        setFaceTexture(4, "attract-panorama-b4");
    }
}

stopAttract()
{
    if (gTimerMode == TIMER_ATTRACT)
    {
        gTimerMode = TIMER_OFF;
        llSetTimerEvent(0.0);
    }
}

startAttract()
{
    gAttractSet = 0;
    applyAttractSet();
    gTimerMode = TIMER_ATTRACT;
    llSetTimerEvent(ATTRACT_SEC);
}

doScreenReset()
{
    stopAttract();
    gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
    gPendingTurnPlayer = 0;
    gCurrentTurnPlayer = 0;
    gTimerMode = TIMER_OFF;
    llSetTimerEvent(0.0);
    gStickyHazard = ["", "", "", ""];
    gStickyLimit = ["", "", "", ""];
    gStickyMoving = ["", "", "", ""];
    gSeatMiles = [0, 0, 0, 0];
}

applyTurnChange(integer currentPlayer)
{
    if (currentPlayer < 1 || currentPlayer > MAX_LANES) return;
    gCurrentTurnPlayer = currentPlayer;
    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (!llList2Integer(gSeatInMatch, p - 1)) jump cont;
        if (p == currentPlayer) setFaceTexture(p, "status-your-turn");
        else setFaceTexture(p, idleScreenForSeat(p));
        @cont;
    }
}

beginSplashHold()
{
    if (gTimerMode == TIMER_GAME_OVER) return;
    if (gTimerMode != TIMER_SPLASH_HOLD) gPendingTurnPlayer = 0;
    gTimerMode = TIMER_SPLASH_HOLD;
    llSetTimerEvent(SPLASH_HOLD_SEC);
}

string placeSlug(integer place)
{
    if (place <= 1) return "end-winner";
    if (place == 2) return "end-2nd-place";
    if (place == 3) return "end-3rd-place";
    return "end-4th-place";
}

handleGameOver(integer first, integer second, integer third, integer fourth, integer pl1, integer pl2, integer pl3, integer pl4)
{
    stopAttract();
    if (pl1 < 1) pl1 = 1;
    if (pl2 < 1) pl2 = 2;
    if (pl3 < 1) pl3 = 3;
    if (pl4 < 1) pl4 = 4;
    list seats = [first, second, third, fourth];
    list places = [pl1, pl2, pl3, pl4];
    integer i;
    integer p;
    for (i = 0; i < MAX_LANES; i++)
    {
        p = llList2Integer(seats, i);
        if (p < 1) jump next_seat;
        setFaceTexture(p, placeSlug(llList2Integer(places, i)));
        @next_seat;
    }
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (p == first && first > 0) jump painted;
        if (p == second && second > 0) jump painted;
        if (p == third && third > 0) jump painted;
        if (p == fourth && fourth > 0) jump painted;
        if (llList2Integer(gSeatInMatch, p - 1)) setFaceTexture(p, "end-game-over");
        else setFaceTexture(p, "status-waiting");
        @painted;
    }
    gTimerMode = TIMER_GAME_OVER;
    llSetTimerEvent(GAME_OVER_HOLD_SEC);
}

paintMatchStart()
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (llList2Integer(gSeatInMatch, p - 1)) setFaceTexture(p, "status-match-start");
        else setFaceTexture(p, "status-waiting");
    }
}

handleCmd(string payload)
{
    list parts = llParseStringKeepNulls(payload, ["|"], []);
    integer n = llGetListLength(parts);
    if (n < 1) return;
    string op = llToUpper(llList2String(parts, 0));

    if (op == "RESET")
    {
        doScreenReset();
        llMessageLinked(LINK_THIS, SCR_RSP, "READY", NULL_KEY);
        return;
    }
    if (op == "ATTRACT")
    {
        string mode = llToLower(llList2String(parts, 1));
        if (mode == "stop") stopAttract();
        else startAttract();
        return;
    }
    if (op == "MATCH")
    {
        integer i;
        for (i = 0; i < MAX_LANES; i++)
        {
            integer flag = 0;
            if (i + 1 < n) flag = (integer)llList2String(parts, i + 1);
            gSeatInMatch = llListReplaceList(gSeatInMatch, [flag != 0], i, i);
        }
        paintMatchStart();
        return;
    }
    if (op == "TURN")
    {
        integer seat = (integer)llList2String(parts, 1);
        gCurrentTurnPlayer = seat;
        if (gTimerMode == TIMER_SPLASH_HOLD)
        {
            gPendingTurnPlayer = seat;
            return;
        }
        if (seat >= 1) applyTurnChange(seat);
        return;
    }
    if (op == "SPLASH")
    {
        beginSplashHold();
        return;
    }
    if (op == "FACE")
    {
        integer seat = (integer)llList2String(parts, 1);
        string slug = llList2String(parts, 2);
        setFaceTexture(seat, slug);
        return;
    }
    if (op == "MILES")
    {
        integer seat = (integer)llList2String(parts, 1);
        integer miles = (integer)llList2String(parts, 2);
        setSeatMiles(seat, miles);
        return;
    }
    if (op == "PLAY")
    {
        integer seat = (integer)llList2String(parts, 1);
        string card = llToUpper(llList2String(parts, 2));
        integer value = (integer)llList2String(parts, 3);
        clearStickiesAfterSelfPlay(seat, card);
        if (card == "DISTANCE" || card == "MILES" || card == "MILEAGE")
        {
            if (llList2String(gStickyMoving, seat - 1) == "") setStickyMoving(seat, "remedy-go");
        }
        setFaceTexture(seat, selfPlayKey(card, value));
        beginSplashHold();
        return;
    }
    if (op == "HIT")
    {
        integer seat = (integer)llList2String(parts, 1);
        string card = llToUpper(llList2String(parts, 2));
        string hit = hazardHitKey(card);
        setFaceTexture(seat, hit);
        if (isSpeedLimitCard(card)) setStickyLimit(seat, hit);
        else setStickyHazard(seat, hit);
        beginSplashHold();
        return;
    }
    if (op == "PLAYHAZARD")
    {
        integer seat = (integer)llList2String(parts, 1);
        string card = llToUpper(llList2String(parts, 2));
        setFaceTexture(seat, hazardPlayKey(card));
        beginSplashHold();
        return;
    }
    if (op == "GAMEOVER")
    {
        integer first = (integer)llList2String(parts, 1);
        integer second = (integer)llList2String(parts, 2);
        integer third = (integer)llList2String(parts, 3);
        integer fourth = (integer)llList2String(parts, 4);
        integer pl1 = 1;
        integer pl2 = 2;
        integer pl3 = 3;
        integer pl4 = 4;
        string extra = "";
        if (n > 5) extra = llToUpper(llList2String(parts, 5));
        if (extra == "PLACES")
        {
            if (n > 6) pl1 = (integer)llList2String(parts, 6);
            if (n > 7) pl2 = (integer)llList2String(parts, 7);
            if (n > 8) pl3 = (integer)llList2String(parts, 8);
            if (n > 9) pl4 = (integer)llList2String(parts, 9);
        }
        else if (extra == "TIE")
        {
            integer tiedCount = 2;
            if (n > 6) tiedCount = (integer)llList2String(parts, 6);
            if (tiedCount < 1) tiedCount = 1;
            if (tiedCount >= 2) pl2 = 1;
            if (tiedCount >= 3) pl3 = 1;
            if (tiedCount >= 4) pl4 = 1;
            if (tiedCount == 2)
            {
                pl3 = 3;
                pl4 = 4;
            }
            if (tiedCount == 3) pl4 = 4;
        }
        handleGameOver(first, second, third, fourth, pl1, pl2, pl3, pl4);
        return;
    }
    debug("unknown SCR_CMD " + op);
}

default
{
    state_entry()
    {
        indexScreensLink();
        doScreenReset();
        startAttract();
        llOwnerSay("Road Trip screens ready (textures in this prim).");
        reportMissingTextures();
        llMessageLinked(LINK_THIS, SCR_RSP, "READY", NULL_KEY);
    }

    on_rez(integer p)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_LINK) indexScreensLink();
        if (change & CHANGED_INVENTORY) reportMissingTextures();
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (num == SCR_CMD) handleCmd(str);
    }

    timer()
    {
        if (gTimerMode == TIMER_ATTRACT)
        {
            if (gAttractSet == 0) gAttractSet = 1;
            else gAttractSet = 0;
            applyAttractSet();
            return;
        }
        if (gTimerMode == TIMER_GAME_OVER)
        {
            gTimerMode = TIMER_OFF;
            llSetTimerEvent(0.0);
            llMessageLinked(LINK_THIS, SCR_RSP, "GAMEOVER_DONE", NULL_KEY);
            return;
        }
        if (gTimerMode == TIMER_SPLASH_HOLD)
        {
            integer pending = gPendingTurnPlayer;
            gPendingTurnPlayer = 0;
            gTimerMode = TIMER_OFF;
            llSetTimerEvent(0.0);
            if (pending < 1) pending = gCurrentTurnPlayer;
            if (pending >= 1) applyTurnChange(pending);
            return;
        }
        llSetTimerEvent(0.0);
    }
}
