// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "hardhat/console.sol";

// Errors
error Bet__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 betState);

/**@title A sample Football bet Contract
 * @author Thomas MARQUES
 * @notice This contract is for creating a sample Football bet Contract
 * @dev This implements a Chainlink external adapter
 */
contract Bet is ChainlinkClient, ConfirmedOwner, KeeperCompatibleInterface {
    using Chainlink for Chainlink.Request;

    // States Vars
    enum contractState {
        PLANNED,
        STARTED,
        ENDED,
        CANCELLED
    }
    enum teamState {
        HOME,
        AWAY,
        DRAW
    }

    mapping(address => mapping(teamState => uint256)) private s_playerToBetToAmount;
    uint256 private s_nbOfPlayer;
    uint256 private constant TIMEOUT = 3000000;

    // Bet vars
    contractState private s_betState;
    uint256 private immutable i_matchId;
    uint32 private immutable i_home;
    uint32 private immutable i_away;
    uint256 private immutable i_matchTimeStamp;
    uint256 private s_lastTimeStamp;
    uint256 private s_matchHomeBetOdd; // in % * 10^30

    // Results vars
    uint8 private s_homeScore;
    uint8 private s_awayScore;
    teamState private s_winner;

    // API vars ?
    string private i_requestUrl;

    // Chainlink var
    bytes32 private immutable i_jobId;
    uint256 private immutable i_fee;
    event RequestWinner(bytes32 indexed requestId, uint256 _matchState);
    event RequestBetWinner(bytes32 indexed requestId);

    // Modifiers
    // modifier onlyOwner() {
    //     // require(msg.sender == i_owner);
    //     if (msg.sender != i_owner) revert Bet__NotOwner();
    //     _;
    // }

    constructor(
        uint256 _matchId,
        uint32 _home,
        uint32 _away,
        uint256 _matchTimeStamp,
        string memory _requestUrl,
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
        s_matchHomeBetOdd = 5 * (10**30);

        // API
        i_requestUrl = _requestUrl;

        // Chainlink
        setChainlinkToken(_linkAddress);
        setChainlinkOracle(_oracleAddress);
        i_jobId = _jobId;
        i_fee = (1 * LINK_DIVISIBILITY) / 10; // 0,1 * 10**18 (Varies by network and job)
    }

    /**
     * @dev toBet fonction : public function that able every user to bet
     * on a team for a given match.
     */
    function toBet(teamState _betSide, uint256 _betAmount) public payable {
        s_playerToBetToAmount[msg.sender][_betSide] += _betAmount;
    }

    /**
     * @dev fundWinners fonction : fonction call when the match is finished.
     * Fund all the addresses that bet on the winner team proportionally
     * to the amount bet.
     */
    function fundWinners() private {}

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The match is supposed to be ended.
     *      - match started + TIMEOUT TIME (5 hours)
     * 2. Once performUpkeep was call one time : (LETS SEE THAT)
     *      - The performUpkeep will be call every day 2 times
     *      - If the api still does not return a winner, the bet will be cancelled
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isStarted = (s_betState == contractState.STARTED);
        bool isSupposedFinish = ((block.timestamp - i_matchTimeStamp) > TIMEOUT);

        upkeepNeeded = (isStarted && isSupposedFinish);
    }

    /*performUpKeep is called when the var upkeepNeeded form checkUpKeep is true*/
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Bet__UpkeepNotNeeded(address(this).balance, s_nbOfPlayer, uint256(s_betState));
        }
        bytes32 requestId = requestWinnerData();
        emit RequestBetWinner(requestId);
    }

    /**
     * @dev This is the function that the Chainlink keeper nodes call
     * if an upKeep is needed (they look for `upkeepNeeded` to return True)
     * And call requestWinnerData() that reach the needed data by making an API
     * call by running a job (build with an external adapter) on a chainlink node.
     */
    function requestWinnerData() private returns (bytes32 requestId) {
        Chainlink.Request memory req = buildChainlinkRequest(
            i_jobId,
            address(this),
            this.fulfill.selector
        );

        // Set the URL to perform the GET request on
        req.add("get", i_requestUrl);
        req.add("path", "data,winId"); // Chainlink nodes 1.0.0 and later support this format

        // Sends the request
        return sendChainlinkRequest(req, i_fee);
    }

    /**
     * Receive the response in the form of bool
     */
    function fulfill(bytes32 _requestId, uint256 _matchState)
        public
        recordChainlinkFulfillment(_requestId)
    {
        emit RequestWinner(_requestId, _matchState);
        if (_matchState == 0) {
            s_betState = contractState.STARTED;
        } else if (_matchState == 1) {
            s_betState = contractState.ENDED;
            s_winner = teamState.HOME;
        } else if (_matchState == 2) {
            s_betState = contractState.ENDED;
            s_winner = teamState.AWAY;
        } else if (_matchState == 3) {
            s_betState = contractState.ENDED;
            s_winner = teamState.DRAW;
        } else if (_matchState == 4) {
            s_betState = contractState.CANCELLED;
            s_winner = teamState.DRAW;
        }

        if (s_betState == contractState.ENDED || s_betState == contractState.CANCELLED) {
            fundWinners();
        }
    }

    /**
     * @dev Allow withdraw of Link tokens from the contract
     */
    function withdrawLink() public onlyOwner {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
    }
}
