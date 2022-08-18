// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "hardhat/console.sol";

// Errors
error Bet__UpkeepNotNeeded(uint256 currentBalance, uint256 betState);
error Bet__betValueNotCorrect(uint256 betState);
error Bet__TransferFailed();
error Bet__FeeTransferFailed();
error Bet__NotPlayer(address addr);
error Bet__SendMoreEth();

/**@title A sample Football bet Contract
 * @author Thomas MARQUES
 * @notice This contract is for creating a sample Football bet Contract
 * @dev This implements a Chainlink external adapter and a chainlink keeper
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
    enum matchState {
        NOT_ENDED,
        HOME,
        AWAY,
        DRAW
    }

    // Bet vars
    address payable[] private s_playerArrayWhoBetHome;
    mapping(address => uint256) s_playerWhoBetHomeToAmount;
    uint256 s_totalBetHome;

    address payable[] private s_playerArrayWhoBetAway;
    mapping(address => uint256) s_playerWhoBetAwayToAmount;
    uint256 s_totalBetAway;

    address payable[] private s_playerArrayWhoBetDraw;
    mapping(address => uint256) s_playerWhoBetDrawToAmount;
    uint256 s_totalBetDraw;

    address private immutable i_owner;
    uint256 private constant FEE = 70000; // % * 10⁵ basis points // fees deducted from the total balance of bets
    uint256 private constant MINIMUM_BET = 10000000000000; // 0.00001 eth
    uint256 private constant TIMEOUT = 24 * 60 * 60; // 1 jour
    contractState private s_betState;
    uint256 private immutable i_matchId;
    uint256 private immutable i_home;
    uint256 private immutable i_away;
    uint256 private immutable i_matchTimeStamp;
    uint256 private s_lastTimeStamp;

    // Results vars
    uint8 private s_homeScore;
    uint8 private s_awayScore;
    matchState private s_winner;

    // API vars
    string private i_requestUrl;

    // Chainlink var
    bytes32 private immutable i_jobId;
    uint256 private immutable i_fee;

    // Events
    event RequestWinner(bytes32 indexed requestId, uint256 _matchState);
    event RequestBetWinner(bytes32 indexed requestId);
    event playerFunded(matchState ms, address indexed winnerAddress);
    event playerRefunded(address indexed playerAddress);

    // Modifiers
    modifier minimumSend() {
        if (msg.value < MINIMUM_BET) revert Bet__SendMoreEth();
        _;
    }

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
        i_owner = msg.sender;
        i_matchId = _matchId;
        i_home = _home;
        i_away = _away;
        i_matchTimeStamp = _matchTimeStamp;
        s_betState = contractState.PLANNED;
        s_totalBetHome = 0;
        s_totalBetAway = 0;
        s_totalBetDraw = 0;
        s_winner = matchState.NOT_ENDED;

        // API
        i_requestUrl = _requestUrl;

        // Chainlink
        setChainlinkToken(_linkAddress);
        setChainlinkOracle(_oracleAddress);
        i_jobId = _jobId;
        i_fee = (1 * LINK_DIVISIBILITY) / 10; // 0,1 * 10**18 (Varies by network and job)
    }

    // Utils functions
    function calculatePercent(uint256 amount, uint256 bPoints) private pure returns (uint256) {
        return (amount * bPoints) / MINIMUM_BET;
    }

    /**
     * @dev toBet fonction : public function that able every user to bet
     * on a team for a given match.
     */
    function toBet(matchState _betSide, uint256 _betAmount) public payable minimumSend {
        if (_betSide == matchState.HOME) {
            s_playerWhoBetHomeToAmount[msg.sender] += _betAmount;
            s_playerArrayWhoBetHome.push(payable(msg.sender));
            s_totalBetHome += msg.value;
        } else if (_betSide == matchState.AWAY) {
            s_playerWhoBetAwayToAmount[msg.sender] += _betAmount;
            s_playerArrayWhoBetAway.push(payable(msg.sender));
            s_totalBetAway += msg.value;
        } else if (_betSide == matchState.DRAW) {
            s_playerWhoBetDrawToAmount[msg.sender] += _betAmount;
            s_playerArrayWhoBetDraw.push(payable(msg.sender));
            s_totalBetDraw += msg.value;
        } else {
            revert Bet__betValueNotCorrect(uint256(_betSide));
        }
    }

    /**
     * @dev able a player to cancel all his bet
     */

    function cancelBet() public payable {
        uint256 homeBetAmount = s_playerWhoBetHomeToAmount[msg.sender];
        uint256 awayBetAmount = s_playerWhoBetAwayToAmount[msg.sender];
        uint256 drawBetAmount = s_playerWhoBetDrawToAmount[msg.sender];

        if (homeBetAmount > 0) {
            s_playerWhoBetHomeToAmount[msg.sender] = 0;
            s_totalBetHome--;
        } else if (awayBetAmount > 0) {
            s_playerWhoBetAwayToAmount[msg.sender] = 0;
            s_totalBetAway--;
        } else if (drawBetAmount > 0) {
            s_playerWhoBetDrawToAmount[msg.sender] = 0;
            s_totalBetDraw--;
        }
        (bool success, ) = msg.sender.call{value: homeBetAmount + awayBetAmount + drawBetAmount}("");
        if (!success) {
            revert Bet__TransferFailed();
        }
    }

    /**
     * @dev fundWinners fonction : fonction call when the match is finished.
     * Fund all the addresses that bet on the winner team proportionally
     * to the amount bet.
     */
    function fundWinners() private {
        // fund the smart contract owner
        uint256 balance = address(this).balance;
        bool success = false;
        if (balance > MINIMUM_BET) {
            (success, ) = i_owner.call{value: calculatePercent(address(this).balance, FEE)}("");
        }
        if (!success) {
            revert Bet__FeeTransferFailed();
        }

        // fund all winning players
        balance = address(this).balance;
        if (s_winner == matchState.HOME) {
            for (uint256 i = 0; i < s_playerArrayWhoBetHome.length; i++) {
                address winnerAddress = s_playerArrayWhoBetHome[i];
                uint256 winnerBetAmount = s_playerWhoBetHomeToAmount[winnerAddress];
                if (winnerBetAmount > 0) {
                    (success, ) = winnerAddress.call{
                        value: calculatePercent(balance, ((winnerBetAmount * MINIMUM_BET) / s_totalBetHome))
                    }("");
                    if (!success) {
                        revert Bet__TransferFailed();
                    }
                    emit playerFunded(matchState.HOME, winnerAddress);
                }
            }
        } else if (s_winner == matchState.AWAY) {
            for (uint256 i = 0; i < s_playerArrayWhoBetAway.length; i++) {
                address winnerAddress = s_playerArrayWhoBetAway[i];
                uint256 winnerBetAmount = s_playerWhoBetAwayToAmount[winnerAddress];
                if (winnerBetAmount > 0) {
                    (success, ) = winnerAddress.call{
                        value: calculatePercent(balance, ((winnerBetAmount * MINIMUM_BET) / s_totalBetAway))
                    }("");
                    if (!success) {
                        revert Bet__TransferFailed();
                    }
                    emit playerFunded(matchState.AWAY, winnerAddress);
                }
            }
        } else if (s_winner == matchState.DRAW) {
            for (uint256 i = 0; i < s_playerArrayWhoBetDraw.length; i++) {
                address winnerAddress = s_playerArrayWhoBetDraw[i];
                uint256 winnerBetAmount = s_playerWhoBetDrawToAmount[winnerAddress];

                if (winnerBetAmount > 0) {
                    (success, ) = winnerAddress.call{
                        value: calculatePercent(balance, ((winnerBetAmount * MINIMUM_BET) / s_totalBetDraw))
                    }("");
                    if (!success) {
                        revert Bet__TransferFailed();
                    }
                    emit playerFunded(matchState.DRAW, winnerAddress);
                }
            }
        } else {
            refundAll();
        }
    }

    /**
     * @dev refund all players :
     * This function is called when the match is cancelled
     * or is case of a fatal error.
     */
    function refundAll() private {
        // Refund all Home bettor
        for (uint256 i = 0; i < s_playerArrayWhoBetHome.length; i++) {
            address playerAddress = s_playerArrayWhoBetHome[i];

            (bool success, ) = playerAddress.call{value: s_playerWhoBetHomeToAmount[playerAddress]}("");
            if (!success) {
                revert Bet__TransferFailed();
            }
            emit playerRefunded(playerAddress);
        }

        // Refund all Away bettor
        for (uint256 i = 0; i < s_playerArrayWhoBetAway.length; i++) {
            address playerAddress = s_playerArrayWhoBetAway[i];

            (bool success, ) = playerAddress.call{value: s_playerWhoBetAwayToAmount[playerAddress]}("");
            if (!success) {
                revert Bet__TransferFailed();
            }
            emit playerRefunded(playerAddress);
        }

        // Refund all Draw bettor
        for (uint256 i = 0; i < s_playerArrayWhoBetDraw.length; i++) {
            address playerAddress = s_playerArrayWhoBetDraw[i];

            (bool success, ) = playerAddress.call{value: s_playerWhoBetDrawToAmount[playerAddress]}("");
            if (!success) {
                revert Bet__TransferFailed();
            }
            emit playerRefunded(playerAddress);
        }
    }

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
        bool hasBalance = address(this).balance > 0;
        bool hasPlayersWhoBetHome = (s_playerArrayWhoBetHome.length > 0);
        bool hasPlayersWhoBetAway = (s_playerArrayWhoBetAway.length > 0);
        bool hasPlayersWhoBetDraw = (s_playerArrayWhoBetDraw.length > 0);

        upkeepNeeded = (isStarted &&
            isSupposedFinish &&
            hasBalance &&
            hasPlayersWhoBetHome &&
            hasPlayersWhoBetAway &&
            hasPlayersWhoBetDraw);
    }

    /*performUpKeep is called when the var upkeepNeeded form checkUpKeep is true*/
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Bet__UpkeepNotNeeded(address(this).balance, uint256(s_betState));
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
        Chainlink.Request memory req = buildChainlinkRequest(i_jobId, address(this), this.fulfill.selector);

        // Set the URL to perform the GET request on
        req.add("get", i_requestUrl);
        req.add("path", "data,winId"); // Chainlink nodes 1.0.0 and later support this format

        // Sends the request
        return sendChainlinkRequest(req, i_fee);
    }

    /**
     * Receive the response in the form of uint256
     */
    function fulfill(bytes32 _requestId, uint256 _matchState) public recordChainlinkFulfillment(_requestId) {
        emit RequestWinner(_requestId, _matchState);
        if (_matchState == 0) {
            s_betState = contractState.STARTED;
        } else if (_matchState == 1) {
            s_betState = contractState.ENDED;
            s_winner = matchState.HOME;
        } else if (_matchState == 2) {
            s_betState = contractState.ENDED;
            s_winner = matchState.AWAY;
        } else if (_matchState == 3) {
            s_betState = contractState.ENDED;
            s_winner = matchState.DRAW;
        } else if (_matchState == 4) {
            s_betState = contractState.CANCELLED;
            s_winner = matchState.DRAW;
        }

        if (s_betState == contractState.ENDED) {
            fundWinners();
        } else if (s_betState == contractState.CANCELLED) {
            refundAll();
        }
    }

    /**
     * @dev Allow withdraw of Link tokens from the contract
     */
    function withdrawLink() public onlyOwner {
        LinkTokenInterface link = LinkTokenInterface(chainlinkTokenAddress());
        require(link.transfer(msg.sender, link.balanceOf(address(this))), "Unable to transfer");
    }

    // Getter functions

    function getFee() public pure returns (uint256) {
        return FEE;
    }

    function getMinimumBet() public pure returns (uint256) {
        return MINIMUM_BET;
    }

    function getAddressToAmountBetOnHome(address fundingAddress) public view returns (uint256) {
        return s_playerWhoBetHomeToAmount[fundingAddress];
    }

    function getAddressToAmountBetOnAway(address fundingAddress) public view returns (uint256) {
        return s_playerWhoBetAwayToAmount[fundingAddress];
    }

    function getAddressToAmountBetOnDraw(address fundingAddress) public view returns (uint256) {
        return s_playerWhoBetDrawToAmount[fundingAddress];
    }

    function getNumberOfPlayersWhoBetHome() public view returns (uint256) {
        return s_playerArrayWhoBetHome.length;
    }

    function getNumberOfPlayersWhoBetAway() public view returns (uint256) {
        return s_playerArrayWhoBetAway.length;
    }

    function getNumberOfPlayersWhoBetDraw() public view returns (uint256) {
        return s_playerArrayWhoBetDraw.length;
    }

    function getSmartContractState() public view returns (contractState) {
        return s_betState;
    }

    function getMatchId() public view returns (uint256) {
        return i_matchId;
    }

    function getHomeTeamId() public view returns (uint256) {
        return i_home;
    }

    function getAwayTeamId() public view returns (uint256) {
        return i_away;
    }

    function getMatchTimeStamp() public view returns (uint256) {
        return i_matchTimeStamp;
    }

    function getWinner() public view returns (matchState) {
        return s_winner;
    }

    function getNumberOfPlayersWhoBtDraw() public view returns (uint256) {
        return s_playerArrayWhoBetDraw.length;
    }
}
