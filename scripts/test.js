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

const { ethers } = require("hardhat")

async function main() {
    // const betTemp = await ethers.getContract("0x1a3D4E4c3B106a4c8618F5D7a2bDE08252a18F03",)
    const { deployer } = await getNamedAccounts()
    console.log("deployer : ", deployer)
    betTemp = await ethers.getContractAt("Bet", "0xf2860AeF8EdBE3Bc73309809Ac84Da05EE77c240", deployer)
    console.log(betTemp.address)
    const chainId = network.config.chainId
    const matchId = 87
    const linkTokenAddress = networkConfig[chainId]["linkToken"]
    console.log("linkTokenAddress : ", linkTokenAddress)

    // // Checking for funding...
    // if (networkConfig[chainId]["fundAmount"] && networkConfig[chainId]["fundAmount"] > 0) {
    //     console.log("Funding with LINK...")
    //     await hre.run("fund-link", {
    //         contract: betTemp.address,
    //         linkaddress: linkTokenAddress,
    //         // fundAmt: "6010000000000000000",
    //     })
    //     console.log("Contract funded with LINK")
    // }

    console.log(`gas : ${networkConfig[chainId]["gasLimitKeeper"]} ||| amount ${networkConfig[chainId]["amountSendToKeeper"]}`)
    const tx = await betTemp.registerAndPredictID(
        `matchID : ${matchId}`,
        networkConfig[chainId]["gasLimitKeeper"],
        networkConfig[chainId]["amountSendToKeeper"],
        { gasLimit: 30000000 }
    )
    await tx.wait(1)

    // bet["registerAndPredictID(string ,uint32 ,uint96)"](
    //     `matchID : ${matchId}`,
    //     networkConfig[chainId]["gasLimitKeeper"],
    //     networkConfig[chainId]["amountSendToKeeper"]
    // )

    console.log("Upkeep ID : ", (await betTemp.getUpkeepID()).toString())
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
