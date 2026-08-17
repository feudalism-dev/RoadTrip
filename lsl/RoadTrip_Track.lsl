// Road Trip — Track (cars + Furware + event routing)
// Sibling to Table. Screens live in RoadTrip_Screens.lsl (same prim).
// Compile: Mono. Geometry: Docs/roadTrip_funcSpec.txt
// See Docs/SECOND_LIFE.md

integer TRACK_CMD_EVENT = 91001;
integer TRACK_CMD_START = 91002;
integer TRACK_CMD_RESET = 91003;
integer TRACK_RSP_RESET_DONE = 91004;
integer SCR_CMD = 91101;
integer SCR_RSP = 91102;

integer FW_NAME_MAX = 32;
integer MAX_LANES = 4;
integer GOAL_MILES = 1000;

float TRACK_START_Y = -3.38593;
float METERS_PER_MILE = 0.00685441;
float CAR_LOCAL_Z = 0.48999;
rotation CAR_LOCAL_ROT = <0.0, 0.0, -1.0, 0.0>;
list CAR_LANE_X = [0.44653, 0.14680, -0.14484, -0.45563];

list gCarLinks = [0, 0, 0, 0];
list gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
list gFwNames = ["", "", "", ""];
list gLaneHasAv = [FALSE, FALSE, FALSE, FALSE];

integer gInMatch = FALSE;
integer gAwaitGameOver = FALSE;
integer DEBUG = FALSE;

integer debug(string m)
{
    if (DEBUG) llOwnerSay("RT TRACK: " + m);
    return TRUE;
}

scr(string cmd)
{
    llMessageLinked(LINK_THIS, SCR_CMD, cmd, NULL_KEY);
}

integer indexCars()
{
    integer n = llGetNumberOfPrims();
    integer i;
    gCarLinks = [0, 0, 0, 0];
    for (i = 1; i <= n; i++)
    {
        string pName = llGetLinkName(i);
        if (pName == "car1") gCarLinks = llListReplaceList(gCarLinks, [i], 0, 0);
        else if (pName == "car2") gCarLinks = llListReplaceList(gCarLinks, [i], 1, 1);
        else if (pName == "car3") gCarLinks = llListReplaceList(gCarLinks, [i], 2, 2);
        else if (pName == "car4") gCarLinks = llListReplaceList(gCarLinks, [i], 3, 3);
    }
    debug("cars=" + llDumpList2String(gCarLinks, ","));
    return TRUE;
}

setCarAlpha(integer playerNum, float alpha)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    integer carLink = llList2Integer(gCarLinks, playerNum - 1);
    if (carLink < 1) return;
    llSetLinkAlpha(carLink, alpha, ALL_SIDES);
}

updateCarPosition(integer playerNum, integer totalMiles)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    if (totalMiles < 0) totalMiles = 0;
    if (totalMiles > GOAL_MILES) totalMiles = GOAL_MILES;
    integer seatIdx = playerNum - 1;
    integer carLink = llList2Integer(gCarLinks, seatIdx);
    if (carLink < 1) return;
    float laneX = llList2Float(CAR_LANE_X, seatIdx);
    float targetY = TRACK_START_Y + ((float)totalMiles * METERS_PER_MILE);
    llSetLinkPrimitiveParamsFast(carLink, [
        PRIM_POS_LOCAL, <laneX, targetY, CAR_LOCAL_Z>,
        PRIM_ROT_LOCAL, CAR_LOCAL_ROT
    ]);
}

snapAllCarsToStart()
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++) updateCarPosition(p, 0);
}

hideAllCars()
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++) setCarAlpha(p, 0.0);
}

showMatchCars()
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (llList2Integer(gSeatInMatch, p - 1)) setCarAlpha(p, 1.0);
        else setCarAlpha(p, 0.0);
    }
}

ensureSeatInMatch(integer playerNum)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    integer idx = playerNum - 1;
    if (llList2Integer(gSeatInMatch, idx)) return;
    gSeatInMatch = llListReplaceList(gSeatInMatch, [TRUE], idx, idx);
    setCarAlpha(playerNum, 1.0);
}

string matchFlagsPipe()
{
    string s = "MATCH";
    integer i;
    for (i = 0; i < MAX_LANES; i++)
    {
        s += "|";
        if (llList2Integer(gSeatInMatch, i)) s += "1";
        else s += "0";
    }
    return s;
}

string truncateFwName(string nm)
{
    if (llStringLength(nm) <= FW_NAME_MAX) return nm;
    return llGetSubString(nm, 0, FW_NAME_MAX - 1);
}

setFwLaneName(integer seat0, string nm)
{
    if (seat0 < 0 || seat0 >= MAX_LANES) return;
    nm = truncateFwName(nm);
    gFwNames = llListReplaceList(gFwNames, [nm], seat0, seat0);
    llMessageLinked(LINK_SET, 0, nm, (key)("fw_data : text" + (string)seat0));
}

applyAllFwNames()
{
    integer i;
    for (i = 0; i < MAX_LANES; i++)
    {
        llMessageLinked(LINK_SET, 0, llList2String(gFwNames, i), (key)("fw_data : text" + (string)i));
    }
}

clearAllFwNames()
{
    gFwNames = ["", "", "", ""];
    applyAllFwNames();
}

string nameFromUid(string uidStr)
{
    if (uidStr == "") return "";
    key av = (key)uidStr;
    if (av == NULL_KEY) return "";
    string nm = llGetDisplayName(av);
    if (nm == "") nm = llKey2Name(av);
    return truncateFwName(nm);
}

string cpuNameForIndex(integer n)
{
    if (n == 0) return "Cruise Control";
    if (n == 1) return "Postcard";
    if (n == 2) return "Road Hog";
    return "CPU " + (string)(n + 1);
}

applyFwNamesFromUids(list uidParts, integer firstIdx)
{
    gLaneHasAv = [FALSE, FALSE, FALSE, FALSE];
    integer cpu = 0;
    integer i;
    for (i = 0; i < MAX_LANES; i++)
    {
        if (!llList2Integer(gSeatInMatch, i))
        {
            setFwLaneName(i, "");
            jump cont;
        }
        string uidStr = "";
        integer pi = firstIdx + i;
        if (pi < llGetListLength(uidParts)) uidStr = llList2String(uidParts, pi);
        string nm = nameFromUid(uidStr);
        if (nm != "")
        {
            gLaneHasAv = llListReplaceList(gLaneHasAv, [TRUE], i, i);
            setFwLaneName(i, nm);
        }
        else
        {
            setFwLaneName(i, cpuNameForIndex(cpu));
            cpu++;
        }
        @cont;
    }
}

applyCpuNamesFromPipe(string payload)
{
    list parts = llParseStringKeepNulls(payload, ["|"], []);
    integer i;
    for (i = 0; i < MAX_LANES; i++)
    {
        if (!llList2Integer(gSeatInMatch, i)) jump cont;
        if (llList2Integer(gLaneHasAv, i)) jump cont;
        string nm = "";
        if (i + 1 < llGetListLength(parts)) nm = llList2String(parts, i + 1);
        if (nm != "") setFwLaneName(i, nm);
        @cont;
    }
}

pickSoloSeats(integer nPlayers, integer humanSeat, list occupied)
{
    gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
    if (nPlayers < 1) nPlayers = 1;
    if (nPlayers > MAX_LANES) nPlayers = MAX_LANES;
    if (humanSeat < 0 || humanSeat >= MAX_LANES) humanSeat = 0;
    gSeatInMatch = llListReplaceList(gSeatInMatch, [TRUE], humanSeat, humanSeat);
    integer need = nPlayers - 1;
    integer i;
    for (i = 0; i < MAX_LANES; i++)
    {
        if (need <= 0) return;
        if (i == humanSeat) jump cont;
        if (llList2Integer(occupied, i)) jump cont;
        gSeatInMatch = llListReplaceList(gSeatInMatch, [TRUE], i, i);
        need--;
        @cont;
    }
    for (i = 0; i < MAX_LANES; i++)
    {
        if (need <= 0) return;
        if (i == humanSeat) jump cont2;
        if (llList2Integer(gSeatInMatch, i)) jump cont2;
        gSeatInMatch = llListReplaceList(gSeatInMatch, [TRUE], i, i);
        need--;
        @cont2;
    }
}

notifyResetDone()
{
    llMessageLinked(LINK_SET, TRACK_RSP_RESET_DONE, "", NULL_KEY);
    debug("TRACK_RSP_RESET_DONE");
}

doCarsReset()
{
    gInMatch = FALSE;
    gAwaitGameOver = FALSE;
    gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
    snapAllCarsToStart();
    hideAllCars();
    clearAllFwNames();
    gLaneHasAv = [FALSE, FALSE, FALSE, FALSE];
}

handleResetCmd()
{
    doCarsReset();
    scr("RESET");
    scr("ATTRACT|start");
    notifyResetDone();
}

finishGameOverHold()
{
    doCarsReset();
    scr("RESET");
    scr("ATTRACT|start");
    notifyResetDone();
}

parseStartSeats(string seatCsv)
{
    gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
    list bits = llParseString2List(seatCsv, [",", " ", ";"], []);
    integer i;
    integer n = llGetListLength(bits);
    for (i = 0; i < n; i++)
    {
        integer p = (integer)llList2String(bits, i);
        if (p >= 1 && p <= MAX_LANES)
        {
            gSeatInMatch = llListReplaceList(gSeatInMatch, [TRUE], p - 1, p - 1);
        }
    }
}

handleStart(string payload)
{
    scr("ATTRACT|stop");
    clearAllFwNames();
    gLaneHasAv = [FALSE, FALSE, FALSE, FALSE];
    list parts = llParseStringKeepNulls(payload, ["|"], []);
    string kind = llToLower(llList2String(parts, 0));

    if (kind == "solo")
    {
        integer nPlayers = (integer)llList2String(parts, 1);
        integer humanSeat = (integer)llList2String(parts, 2);
        list occupied = [FALSE, FALSE, FALSE, FALSE];
        integer i;
        for (i = 0; i < MAX_LANES; i++)
        {
            string uidStr = "";
            if (3 + i < llGetListLength(parts)) uidStr = llList2String(parts, 3 + i);
            if (uidStr != "" && (key)uidStr != NULL_KEY)
            {
                occupied = llListReplaceList(occupied, [TRUE], i, i);
            }
        }
        pickSoloSeats(nPlayers, humanSeat, occupied);
        gInMatch = TRUE;
        snapAllCarsToStart();
        showMatchCars();
        applyFwNamesFromUids(parts, 3);
    }
    else if (kind == "match")
    {
        gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
        integer i;
        for (i = 0; i < MAX_LANES; i++)
        {
            string uidStr = "";
            if (1 + i < llGetListLength(parts)) uidStr = llList2String(parts, 1 + i);
            if (uidStr != "" && (key)uidStr != NULL_KEY)
            {
                gSeatInMatch = llListReplaceList(gSeatInMatch, [TRUE], i, i);
            }
        }
        gInMatch = TRUE;
        snapAllCarsToStart();
        showMatchCars();
        applyFwNamesFromUids(parts, 1);
    }
    else
    {
        parseStartSeats(payload);
        if (payload == "") gSeatInMatch = [TRUE, TRUE, TRUE, TRUE];
        gInMatch = TRUE;
        snapAllCarsToStart();
        showMatchCars();
    }
    scr(matchFlagsPipe());
    debug("START " + payload);
}

handleEventPipe(string payload)
{
    list parts = llParseStringKeepNulls(payload, ["|"], []);
    integer n = llGetListLength(parts);
    if (n < 1) return;

    string ev = llToUpper(llList2String(parts, 0));
    integer playerNum = 0;
    integer targetNum = 0;
    string card = "";
    integer value = 0;
    integer miles = 0;
    if (n > 1) playerNum = (integer)llList2String(parts, 1);
    if (n > 2) targetNum = (integer)llList2String(parts, 2);
    if (n > 3) card = llToUpper(llList2String(parts, 3));
    if (n > 4) value = (integer)llList2String(parts, 4);
    if (n > 5) miles = (integer)llList2String(parts, 5);

    if (ev == "GAME_OVER")
    {
        integer first = playerNum;
        integer second = targetNum;
        integer third = value;
        integer fourth = miles;
        if (card != "RANK")
        {
            if (first < 1) first = second;
            second = 0;
            third = 0;
            fourth = 0;
        }
        else
        {
            if (second == first) second = 0;
            if (third == first || third == second) third = 0;
            if (fourth == first || fourth == second || fourth == third) fourth = 0;
        }
        gInMatch = FALSE;
        gAwaitGameOver = TRUE;
        string over = "GAMEOVER|" + (string)first + "|" + (string)second + "|" + (string)third + "|" + (string)fourth;
        if (n > 6 && llToUpper(llList2String(parts, 6)) == "PLACES")
        {
            integer pl1 = 1;
            integer pl2 = 2;
            integer pl3 = 3;
            integer pl4 = 4;
            if (n > 7) pl1 = (integer)llList2String(parts, 7);
            if (n > 8) pl2 = (integer)llList2String(parts, 8);
            if (n > 9) pl3 = (integer)llList2String(parts, 9);
            if (n > 10) pl4 = (integer)llList2String(parts, 10);
            over += "|PLACES|" + (string)pl1 + "|" + (string)pl2 + "|" + (string)pl3 + "|" + (string)pl4;
        }
        else if (n > 6 && llToUpper(llList2String(parts, 6)) == "TIE")
        {
            integer tiedCount = 2;
            if (n > 7) tiedCount = (integer)llList2String(parts, 7);
            if (tiedCount < 1) tiedCount = 1;
            over += "|TIE|" + (string)tiedCount;
        }
        scr(over);
        return;
    }

    if (!gInMatch)
    {
        debug("ignore event while idle: " + ev);
        return;
    }

    if (ev == "NAMES")
    {
        applyCpuNamesFromPipe(payload);
        return;
    }

    if (ev == "MILEAGE")
    {
        integer seat = targetNum;
        if (seat < 1) seat = playerNum;
        ensureSeatInMatch(seat);
        updateCarPosition(seat, miles);
        scr("MILES|" + (string)seat + "|" + (string)miles);
        scr("PLAY|" + (string)seat + "|" + card + "|" + (string)value);
        return;
    }

    if (ev == "HAZARD")
    {
        integer tgt = targetNum;
        integer act = playerNum;
        if (tgt < 1) tgt = act;
        ensureSeatInMatch(tgt);
        if (act >= 1) ensureSeatInMatch(act);
        updateCarPosition(tgt, miles);
        scr("MILES|" + (string)tgt + "|" + (string)miles);
        scr("HIT|" + (string)tgt + "|" + card);
        if (act >= 1 && act != tgt) scr("PLAYHAZARD|" + (string)act + "|" + card);
        return;
    }

    if (ev == "SAFETY" || ev == "REMEDY")
    {
        integer seat = targetNum;
        if (seat < 1) seat = playerNum;
        ensureSeatInMatch(seat);
        updateCarPosition(seat, miles);
        scr("MILES|" + (string)seat + "|" + (string)miles);
        scr("PLAY|" + (string)seat + "|" + card + "|" + (string)value);
        return;
    }

    if (ev == "TURN_CHANGE")
    {
        if (playerNum < 1 || playerNum > MAX_LANES) return;
        ensureSeatInMatch(playerNum);
        scr("TURN|" + (string)playerNum);
        return;
    }

    debug("unknown EVENT_TYPE=" + ev);
}

default
{
    state_entry()
    {
        indexCars();
        doCarsReset();
        scr("RESET");
        scr("ATTRACT|start");
        llOwnerSay("Road Trip track ready (cars). Screens script must also be in this prim.");
    }

    on_rez(integer startParam)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_LINK) indexCars();
    }

    link_message(integer sender, integer num, string str, key id)
    {
        if (id == "fw_ready")
        {
            applyAllFwNames();
            return;
        }
        if (num == SCR_RSP)
        {
            if (str == "GAMEOVER_DONE" && gAwaitGameOver)
            {
                finishGameOverHold();
            }
            return;
        }
        if (num == TRACK_CMD_EVENT)
        {
            handleEventPipe(str);
            return;
        }
        if (num == TRACK_CMD_START)
        {
            handleStart(str);
            return;
        }
        if (num == TRACK_CMD_RESET)
        {
            handleResetCmd();
            return;
        }
    }
}
