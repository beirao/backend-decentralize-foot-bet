const { getNamedAccounts, deployments, network, run } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    FEE_OWNER,
    MINIMUM_BET,
    TIMEOUT,
} = require("../helper-hardhat-config")
const { autoFundCheck, verify } = require("../helper-functions")

const MyContract = ethers.getContractFactory("Bet")
const betTemp = MyContract.attach(
    "0xd060dfFeb40440e84937CB00F959D328D4606E66" // The deployed contract address
)

// console.log(`gas : ${networkConfig[chainId]["gasLimitKeeper"]} ||| amount ${networkConfig[chainId]["amountSendToKeeper"]}`)
// const tx = betTemp.registerAndPredictID(
//     `matchID : ${matchId}`,
//     networkConfig[chainId]["gasLimitKeeper"],
//     networkConfig[chainId]["amountSendToKeeper"],
//     { gasLimit: 30000000 }
// )
// tx.wait(1)

// bet["registerAndPredictID(string ,uint32 ,uint96)"](
//     `matchID : ${matchId}`,
//     networkConfig[chainId]["gasLimitKeeper"],
//     networkConfig[chainId]["amountSendToKeeper"]
// )

log("Upkeep ID : ", betTemp.getUpkeepID())
