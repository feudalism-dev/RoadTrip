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
    //     NAMES|name0|name1|name2|name3  — Furware labels by AVsitter seat (CPU lanes).
    //     Examples:
    //       MILEAGE|1|1|DISTANCE|200|325
    //       HAZARD|2|4|FLAT_TIRE|0|150
    //       SAFETY|3|3|EXTRA_TANK|0|450
    //       GAME_OVER|1|2|RANK|3|4   (1st..4th wire seats; 0 unused)
    //       GAME_OVER|1|1|NONE|0|1000  (legacy: winner only)
    //
    //   TRACK_CMD_START = 91002
    //     str =
    //       solo|<nPlayers>|<humanSeat0>|<uid0>|<uid1>|<uid2>|<uid3>
    //       match|<uid0>|<uid1>|<uid2>|<uid3>   (empty uid = not in match)
    //       legacy: "1,2,3" seat numbers (no names)
    //     Track picks lanes, shows cars, sets Furware text0–text3 from llGetDisplayName.
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

    integer FW_NAME_MAX = 32;

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
    // Cached Furware labels (seat 0–3); replayed on fw_ready.
    list gFwNames = ["", "", "", ""];
    // TRUE if that lane is a seated avatar (keep llGetDisplayName; do not overwrite).
    list gLaneHasAv = [FALSE, FALSE, FALSE, FALSE];
    // Sticky spectator screens while not YOUR TURN (why this lane isn't racing).
    // Battle hazard hit (out of gas, flat, …) takes priority over speed limit.
    list gStickyHazard = ["", "", "", ""];
    list gStickyLimit = ["", "", "", ""];

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

    string truncateFwName(string nm)
    {
        if (llStringLength(nm) <= FW_NAME_MAX) return nm;
        return llGetSubString(nm, 0, FW_NAME_MAX - 1);
    }

    // Furware sets are named text0..text3 (one per lane / AVsitter seat).
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
            string nm = llList2String(gFwNames, i);
            llMessageLinked(LINK_SET, 0, nm, (key)("fw_data : text" + (string)i));
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

    // Keep in sync with src/ui/gameHelpers.ts AI_NAMES.
    string cpuNameForIndex(integer n)
    {
        if (n == 0) return "Cruise Control";
        if (n == 1) return "Night Owl";
        if (n == 2) return "Road Hog";
        return "CPU " + (string)(n + 1);
    }

    applyFwNamesFromUids(list uidParts, integer firstIdx)
    {
        // Avatars → llGetDisplayName. Empty-UID match lanes → CPU names (same order as web wire map).
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

    // Web NAMES|n0|n1|n2|n3 — fill CPU lanes only (humans keep SL display name).
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
        debug("NAMES " + payload);
    }

    // Solo: human lane + empty chairs for AI (same rules Table used to own).
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
        clearAllFwNames();
        gLaneHasAv = [FALSE, FALSE, FALSE, FALSE];
        gStickyHazard = ["", "", "", ""];
        gStickyLimit = ["", "", "", ""];
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

    string idleScreenForSeat(integer playerNum)
    {
        integer idx = playerNum - 1;
        string hazard = llList2String(gStickyHazard, idx);
        if (hazard != "") return hazard;
        string lim = llList2String(gStickyLimit, idx);
        if (lim != "") return lim;
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
        // Clears battle-pile stuck state (not miles, not end-limit alone).
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

    // Remedy / safety / GO clears sticky; pure DISTANCE miles leave speed-limit sticky.
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
            return;
        }
        if (isEmergencyVehicleCard(card))
        {
            clearStickyHazard(playerNum);
            clearStickyLimit(playerNum);
            return;
        }
        // Other safeties clear battle hazard only.
        if (card == "ACE" || card == "DRIVING_ACE" || card == "TANK" || card == "EXTRA_TANK"
            || card == "TIRES" || card == "PUNCTURE_PROOF" || card == "PUNCTURE-PROOF"
            || card == "HOV" || card == "FAST_LANE" || card == "LOCK" || card == "GPS_LOCK")
        {
            clearStickyHazard(playerNum);
        }
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
                // Always YOUR TURN while driving — even if still hazard-stuck.
                setFaceTexture(p, "status-your-turn");
            }
            else
            {
                // Prefer sticky hazard / speed limit so spectators see why they wait.
                setFaceTexture(p, idleScreenForSeat(p));
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
            clearStickiesAfterSelfPlay(seat, card);
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
            string hit = hazardHitKey(card);
            setFaceTexture(tgt, hit);
            if (isSpeedLimitCard(card)) setStickyLimit(tgt, hit);
            else setStickyHazard(tgt, hit);
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
            clearStickiesAfterSelfPlay(seat, card);
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

    handleStart(string payload)
    {
        stopAttract();
        gTimerMode = TIMER_OFF;
        gPendingTurnPlayer = 0;
        gCurrentTurnPlayer = 0;
        llSetTimerEvent(0.0);
        clearAllFwNames();
        gLaneHasAv = [FALSE, FALSE, FALSE, FALSE];
        gStickyHazard = ["", "", "", ""];
        gStickyLimit = ["", "", "", ""];

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
            // Legacy: "1,2,3" seat numbers only (no Furware names).
            parseStartSeats(payload);
            if (payload == "")
            {
                gSeatInMatch = [TRUE, TRUE, TRUE, TRUE];
            }
            gInMatch = TRUE;
            snapAllCarsToStart();
            showMatchCars();
        }

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
        debug("START " + payload);
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
            // Furware engine finished init / reset — re-push lane labels.
            if (id == "fw_ready")
            {
                applyAllFwNames();
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
