// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";

contract bet is ChainlinkClient, ConfirmedOwner {
    using Chainlink for Chainlink.Request;

    // States Vars
    enum contractState {
        PLANNED,
        STARTED,
        ENDED
    }
    enum teamState {
        HOME,
        AWAY,
        NULL
    }

    address payable[] private s_players;
    uint256[] private s_sumBet;
    teamState[] private s_teamBet;
    uint256 private constant TIMEOUT = 3000000;

    // Bet vars
    contractState private s_betState;
    uint256 private immutable i_matchId;
    uint32 private immutable i_home;
    uint32 private immutable i_away;
    uint256 private immutable i_matchTimeStamp;
    uint256 private s_lastTimeStamp;
    uint256 private s_matchOdds; // *10^3

    // Results vars
    uint8 private s_homeScore;
    uint8 private s_awayScore;
    teamState private s_winner;

    // API vars
    string private i_XRapidAPIKey;
    string private i_XRapidAPIHost;
    string private i_requestUrl;

    // Chainlink var
    bytes32 private immutable i_jobId;
    uint256 private immutable i_fee;
    event RequestWinner(bytes32 indexed requestId, bool _homeState);

    constructor(
        uint256 _matchId,
        uint32 _home,
        uint32 _away,
        uint256 _matchTimeStamp,
        string memory _requestUrl,
        string memory _XRapidAPIKey,
        string memory _XRapidAPIHost,
        address _oracleAddress,
        address _linkAddress,
        bytes32 _jobId
    ) ConfirmedOwner(msg.sender) {
        // Global
        i_matchId = _matchId;
        i_home = _home;
        i_away = _away;
        i_matchTimeStamp = _matchTimeStamp;
        s_betState = contractState.PLANNED;
        s_matchOdds = 1000;
        i_XRapidAPIKey = _XRapidAPIKey;
        i_XRapidAPIHost = _XRapidAPIHost;

        // API
        i_requestUrl = _requestUrl;

        // Chainlink
        setChainlinkToken(_linkAddress);
        setChainlinkOracle(_oracleAddress);
        i_jobId = _jobId;
        i_fee = (1 * LINK_DIVISIBILITY) / 10; // 0,1 * 10**18 (Varies by network and job)
    }

    function toBet(uint256 _betAmount, teamState _betSide) public payable {}

    function fundWinners() private {}

    function requestVolumeData() public returns (bytes32 requestId) {
        Chainlink.Request memory req = buildChainlinkRequest(
            i_jobId,
            address(this),
            this.fulfill.selector
        );

        // Set the URL to perform the GET request on
        req.add("get", i_requestUrl);
        // req.add("header",ouo); ???
        req.add("path", "response,teams,home,winner"); // Chainlink nodes 1.0.0 and later support this format

        // Sends the request
        return sendChainlinkRequest(req, i_fee);
    }

    /**
     * Receive the response in the form of bool
     */
    function fulfill(bytes32 _requestId, bool _homeState)
        public
        recordChainlinkFulfillment(_requestId)
    {
        emit RequestWinner(_requestId, _homeState);
        if (_homeState == true) {
            s_winner = teamState.HOME;
        } else if (_homeState == false) {
            s_winner = teamState.AWAY;
        } else {
            s_winner = teamState.NULL;
        }
    }
}
