// Road Trip — Track Display (cars + screens)
// Sibling to RoadTrip_Table.lsl. Receives link messages; does not own HTTP-IN.
// Compile: Mono. Geometry: Docs/roadTrip_funcSpec.txt
// Screen keys: Docs/TABLE_SCREEN_ASSETS.md
//
//==============================================================================
// LINK PROTOCOL (Table ↔ Track)
//==============================================================================
// Table → Track:
//   TRACK_CMD_EVENT = 91001
//     str = pipe payload: EVENT|player|target|CARD|value|miles
//     Examples:
//       MILEAGE|1|1|DISTANCE|200|325
//       HAZARD|2|4|FLAT_TIRE|0|150
//       SAFETY|3|3|EXTRA_TANK|0|450
//       GAME_OVER|1|2|RANK|3|4   (1st..4th wire seats; 0 unused)
//       GAME_OVER|1|1|NONE|0|1000  (legacy: winner only)
//
//   TRACK_CMD_START = 91002
//     str = comma-separated player nums in match, e.g. "1,2" or "1,2,3,4"
//     Stops attract, snaps cars to 0 mi, shows only those cars, MATCH_START screens.
//
//   TRACK_CMD_RESET = 91003
//     str ignored. Force cars→0, hide cars, restart attract; replies when done.
//
// Track → Table:
//   TRACK_RSP_RESET_DONE = 91004
//     str = "" — emitted after GAME_OVER delay reset, or after TRACK_CMD_RESET.
//
//==============================================================================

integer TRACK_CMD_EVENT = 91001;
integer TRACK_CMD_START = 91002;
integer TRACK_CMD_RESET = 91003;
integer TRACK_RSP_RESET_DONE = 91004;

integer MAX_LANES = 4;
integer GOAL_MILES = 1000;

float TRACK_START_Y = -3.38593;
float METERS_PER_MILE = 0.00685441;
float CAR_LOCAL_Z = 0.48999;
rotation CAR_LOCAL_ROT = <0.0, 0.0, -1.0, 0.0>;
list CAR_LANE_X = [0.44653, 0.14680, -0.14484, -0.45563];

float ATTRACT_SEC = 6.0;
float GAME_OVER_HOLD_SEC = 5.0;
float HAZARD_HOLD_SEC = 3.0;

// Inventory texture names = slug only (no date, no v4_, no .png).
// Upload from assets/table_screens_upload/<slug>.png — inventory name = <slug>
// e.g. hazard-hit-flat-tire.png → inventory name hazard-hit-flat-tire
// textureFor() uses llGetInventoryKey; also accepts a leftover v4_ prefix.

// Timer modes
integer TIMER_OFF = 0;
integer TIMER_ATTRACT = 1;
integer TIMER_GAME_OVER = 2;
integer TIMER_HAZARD_HOLD = 3;

integer gScreensLink = 0;
list gCarLinks = [0, 0, 0, 0];
list gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];

integer gInMatch = FALSE;
integer gAttractOn = FALSE;
integer gAttractSet = 0; // 0 = panorama A, 1 = panorama B
integer gTimerMode = 0;
integer gPendingTurnPlayer = 0;
// Wire lane 1–4 that currently owns YOUR TURN (0 = none).
integer gCurrentTurnPlayer = 0;
integer DEBUG = FALSE;

integer debug(string m)
{
    if (DEBUG) llOwnerSay("RT TRACK: " + m);
    return TRUE;
}

// ---------------------------------------------------------------------------
// Textures — inventory names match scripts/gen_table_screens_v4.py slugs
// ---------------------------------------------------------------------------
key textureFor(string invName)
{
    if (invName == "") invName = "dummy-placeholder";

    key k = llGetInventoryKey(invName);
    if (k != NULL_KEY) return k;

    // Allow leaving the v4_ prefix on upload names
    k = llGetInventoryKey("v4_" + invName);
    if (k != NULL_KEY) return k;

    k = llGetInventoryKey("dummy-placeholder");
    if (k != NULL_KEY) return k;

    k = llGetInventoryKey("v4_dummy-placeholder");
    if (k != NULL_KEY) return k;

    debug("missing texture inventory: " + invName);
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
            if (missing <= 8) llOwnerSay("RT TRACK missing texture: " + nm);
        }
    }
    if (missing > 8) llOwnerSay("RT TRACK … and " + (string)(missing - 8) + " more missing.");
    if (missing == 0) llOwnerSay("RT TRACK: all " + (string)n + " screen textures found in inventory.");
}

integer indexLinks()
{
    integer n = llGetNumberOfPrims();
    integer i;
    gScreensLink = 0;
    gCarLinks = [0, 0, 0, 0];

    for (i = 1; i <= n; i++)
    {
        string pName = llGetLinkName(i);
        if (pName == "screens") gScreensLink = i;
        else if (pName == "car1") gCarLinks = llListReplaceList(gCarLinks, [i], 0, 0);
        else if (pName == "car2") gCarLinks = llListReplaceList(gCarLinks, [i], 1, 1);
        else if (pName == "car3") gCarLinks = llListReplaceList(gCarLinks, [i], 2, 2);
        else if (pName == "car4") gCarLinks = llListReplaceList(gCarLinks, [i], 3, 3);
    }
    debug("screens=" + (string)gScreensLink
        + " cars=" + llDumpList2String(gCarLinks, ","));
    return TRUE;
}

setFaceTexture(integer playerNum, string texKey)
{
    if (gScreensLink < 1) return;
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    integer faceIdx = playerNum - 1;
    llSetLinkTexture(gScreensLink, textureFor(texKey), faceIdx);
}

setAllFaces(string texKey)
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        setFaceTexture(p, texKey);
    }
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
    vector targetLocalPos = <laneX, targetY, CAR_LOCAL_Z>;

    llSetLinkPrimitiveParamsFast(carLink, [
        PRIM_POS_LOCAL, targetLocalPos,
        PRIM_ROT_LOCAL, CAR_LOCAL_ROT
    ]);
}

snapAllCarsToStart()
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        updateCarPosition(p, 0);
    }
}

hideAllCars()
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        setCarAlpha(p, 0.0);
    }
}

showMatchCars()
{
    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (llList2Integer(gSeatInMatch, p - 1))
        {
            setCarAlpha(p, 1.0);
        }
        else
        {
            setCarAlpha(p, 0.0);
        }
    }
}

ensureSeatInMatch(integer playerNum)
{
    if (playerNum < 1 || playerNum > MAX_LANES) return;
    integer idx = playerNum - 1;
    if (llList2Integer(gSeatInMatch, idx)) return;
    gSeatInMatch = llListReplaceList(gSeatInMatch, [TRUE], idx, idx);
    setCarAlpha(playerNum, 1.0);
    debug("ensureSeatInMatch " + (string)playerNum);
}

applyAttractSet()
{
    // Same panorama set on faces 0–3 together (A1–A4 or B1–B4).
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
    gAttractOn = FALSE;
    if (gTimerMode == TIMER_ATTRACT)
    {
        gTimerMode = TIMER_OFF;
        llSetTimerEvent(0.0);
    }
}

startAttract()
{
    gAttractOn = TRUE;
    gAttractSet = 0;
    applyAttractSet();
    gTimerMode = TIMER_ATTRACT;
    llSetTimerEvent(ATTRACT_SEC);
}

notifyResetDone()
{
    llMessageLinked(LINK_SET, TRACK_RSP_RESET_DONE, "", NULL_KEY);
    debug("TRACK_RSP_RESET_DONE");
}

doFullReset()
{
    stopAttract();
    gInMatch = FALSE;
    gSeatInMatch = [FALSE, FALSE, FALSE, FALSE];
    gPendingTurnPlayer = 0;
    gCurrentTurnPlayer = 0;
    gTimerMode = TIMER_OFF;
    llSetTimerEvent(0.0);
    snapAllCarsToStart();
    hideAllCars();
}

// ---- CARD_TYPE → texture key mapping (synonyms from funcSpec + cards.ts) ----

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
    // Distance / remedy / safety played on self → inventory slug.
    if (card == "DISTANCE" || card == "MILES" || card == "MILEAGE")
    {
        return milesKey(value);
    }
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

// Places are wire seats 1–4; 0 = unused (fewer players).
handleGameOver(integer first, integer second, integer third, integer fourth)
{
    stopAttract();
    gInMatch = FALSE;

    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (p == first && first > 0)
        {
            setFaceTexture(p, "end-winner");
        }
        else if (p == second && second > 0)
        {
            setFaceTexture(p, "end-2nd-place");
        }
        else if (p == third && third > 0)
        {
            setFaceTexture(p, "end-3rd-place");
        }
        else if (p == fourth && fourth > 0)
        {
            setFaceTexture(p, "end-4th-place");
        }
        else if (llList2Integer(gSeatInMatch, p - 1))
        {
            setFaceTexture(p, "end-game-over");
        }
        else
        {
            setFaceTexture(p, "status-waiting");
        }
    }

    gTimerMode = TIMER_GAME_OVER;
    llSetTimerEvent(GAME_OVER_HOLD_SEC);
    debug("GAME_OVER places=" + (string)first + "," + (string)second
        + "," + (string)third + "," + (string)fourth);
}

applyTurnChange(integer currentPlayer)
{
    if (currentPlayer < 1 || currentPlayer > MAX_LANES) return;
    gCurrentTurnPlayer = currentPlayer;
    ensureSeatInMatch(currentPlayer);

    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (!llList2Integer(gSeatInMatch, p - 1)) jump cont;
        if (p == currentPlayer)
        {
            setFaceTexture(p, "status-your-turn");
        }
        else
        {
            // Never leave YOUR TURN on anyone else — WAITING for all other match lanes.
            setFaceTexture(p, "status-waiting");
        }
        @cont;
    }
    debug("TURN_CHANGE player=" + (string)currentPlayer);
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
        // Ranked seats: GAME_OVER|1st|2nd|RANK|3rd|4th  (0 = unused).
        // Legacy: GAME_OVER|winner|winner|NONE|0|miles → only 1st set.
        integer first = playerNum;
        integer second = targetNum;
        integer third = value;
        integer fourth = miles;
        if (card != "RANK")
        {
            // Old payload: treat player as winner only.
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
        handleGameOver(first, second, third, fourth);
        return;
    }

    if (!gInMatch)
    {
        // Ignore mid-game events while idle (except GAME_OVER handled above).
        debug("ignore event while idle: " + ev);
        return;
    }

    if (ev == "MILEAGE")
    {
        integer seat = targetNum;
        if (seat < 1) seat = playerNum;
        ensureSeatInMatch(seat);
        updateCarPosition(seat, miles);
        setFaceTexture(seat, selfPlayKey(card, value));
        return;
    }

    if (ev == "HAZARD")
    {
        // HIT on TARGET face; PLAY on ACTOR (player) face.
        integer tgt = targetNum;
        integer act = playerNum;
        if (tgt < 1) tgt = act;
        ensureSeatInMatch(tgt);
        if (act >= 1) ensureSeatInMatch(act);
        updateCarPosition(tgt, miles);
        setFaceTexture(tgt, hazardHitKey(card));
        if (act >= 1 && act != tgt)
        {
            setFaceTexture(act, hazardPlayKey(card));
        }
        // Hold before YOUR TURN so victim/attacker can read the hazard splash.
        // Do not clear gPendingTurnPlayer if a TURN_CHANGE already queued this hold.
        if (gTimerMode != TIMER_GAME_OVER)
        {
            if (gTimerMode != TIMER_HAZARD_HOLD) gPendingTurnPlayer = 0;
            gTimerMode = TIMER_HAZARD_HOLD;
            llSetTimerEvent(HAZARD_HOLD_SEC);
        }
        return;
    }

    if (ev == "SAFETY" || ev == "REMEDY")
    {
        integer seat = targetNum;
        if (seat < 1) seat = playerNum;
        ensureSeatInMatch(seat);
        updateCarPosition(seat, miles);
        setFaceTexture(seat, selfPlayKey(card, value));
        return;
    }

    if (ev == "TURN_CHANGE")
    {
        if (playerNum < 1 || playerNum > MAX_LANES) return;
        // Always remember the latest driver — supersedes any older pending turn.
        gCurrentTurnPlayer = playerNum;
        // Defer while hazard splash is showing.
        if (gTimerMode == TIMER_HAZARD_HOLD)
        {
            gPendingTurnPlayer = playerNum;
            return;
        }
        applyTurnChange(playerNum);
        return;
    }

    debug("unknown EVENT_TYPE=" + ev);
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

handleStart(string seatCsv)
{
    stopAttract();
    gTimerMode = TIMER_OFF;
    gPendingTurnPlayer = 0;
    llSetTimerEvent(0.0);

    parseStartSeats(seatCsv);
    gCurrentTurnPlayer = 0;
    // If empty CSV, treat as all four (solo/debug fallback).
    if (seatCsv == "")
    {
        gSeatInMatch = [TRUE, TRUE, TRUE, TRUE];
    }

    gInMatch = TRUE;
    snapAllCarsToStart();
    showMatchCars();

    integer p;
    for (p = 1; p <= MAX_LANES; p++)
    {
        if (llList2Integer(gSeatInMatch, p - 1))
        {
            setFaceTexture(p, "status-match-start");
        }
        else
        {
            setFaceTexture(p, "status-waiting");
        }
    }
    debug("START seats=" + seatCsv);
}

handleResetCmd()
{
    doFullReset();
    startAttract();
    notifyResetDone();
}

finishGameOverHold()
{
    doFullReset();
    startAttract();
    notifyResetDone();
}

default
{
    state_entry()
    {
        indexLinks();
        doFullReset();
        startAttract();
        llOwnerSay("Road Trip track ready. Drop screen textures from assets/table_screens_upload/ into this prim (inventory name = filename without .png).");
        reportMissingTextures();
    }

    on_rez(integer startParam)
    {
        llResetScript();
    }

    changed(integer change)
    {
        if (change & CHANGED_LINK)
        {
            indexLinks();
        }
        if (change & CHANGED_INVENTORY)
        {
            reportMissingTextures();
        }
    }

    link_message(integer sender, integer num, string str, key id)
    {
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
            finishGameOverHold();
            return;
        }
        if (gTimerMode == TIMER_HAZARD_HOLD)
        {
            integer pending = gPendingTurnPlayer;
            gPendingTurnPlayer = 0;
            gTimerMode = TIMER_OFF;
            llSetTimerEvent(0.0);
            // Prefer explicit pending TURN_CHANGE; else restore last known driver.
            if (pending < 1) pending = gCurrentTurnPlayer;
            if (pending >= 1) applyTurnChange(pending);
            return;
        }
        llSetTimerEvent(0.0);
    }
}
