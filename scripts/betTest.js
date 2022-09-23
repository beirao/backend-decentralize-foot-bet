const { getNamedAccounts, deployments, network } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    FEE_OWNER,
    MINIMUM_BET,
    TIMEOUT,
} = require("../helper-hardhat-config")
const { autoFundCheck, verify } = require("../helper-functions")
const { LinkTokenInterface } = require("@appliedblockchain/chainlink-contracts/abi/LinkTokenInterface.json")
const { assert, expect } = require("chai")

async function main() {
    const matchId = "777" // DRAW
    const BET_PRICE = ethers.utils.parseEther("0.01")

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const { deploy, log, get } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let linkTokenAddress, timeout, apiUrl
    let matchTimestamp
    let oracle
    let additionalMessage = ""
    //set log level to ignore non errors
    ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR)

    timeout = 60 // 1 minutes
    matchTimestamp = Math.trunc(Date.now() * 0.001) + 5 * 60 // 5 minutes
    apiUrl = process.env.API_URL
    linkTokenAddress = networkConfig[chainId]["linkToken"]
    oracle = networkConfig[chainId]["oracle"]

    log("deployer : ", deployer)
    log("linkTokenAddress : ", linkTokenAddress)

    const jobId = ethers.utils.toUtf8Bytes(networkConfig[chainId]["jobId"])
    const requestFee = networkConfig[chainId]["requestFee"]
    const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS

    const args = [matchId, matchTimestamp, timeout, oracle, apiUrl, jobId, requestFee, linkTokenAddress]
    console.log("args : ", args)
    console.log("Deploying Bet... ")
    const bet = await deploy("Bet", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        await verify(bet.address, args)
    }

    // Checking for funding...
    log("Funding needed ? ", networkConfig[chainId]["fundAmount"])
    if (networkConfig[chainId]["fundAmount"] && networkConfig[chainId]["fundAmount"] > 0) {
        log("Funding with LINK...")
        if (await autoFundCheck(bet.address, network.name, linkTokenAddress, additionalMessage)) {
            await hre.run("fund-link", {
                contract: bet.address,
                fundAmt: networkConfig[chainId]["fundAmount"],
                linkaddress: linkTokenAddress,
            })
        } else {
            log("Contract already has LINK!")
        }
    }

    log("Run Bet contract with following command:")
    const networkName = network.name == "hardhat" ? "localhost" : network.name
    log(`yarn hardhat request-data --contract ${bet.address} --network ${networkName}`)
    log("----------------------------------------------------")

    // describe("Bet constructor", async function () {
    //     it("Check vars initialisation", async () => {
    //         const betFee = await bet.getFee()
    //         const minBet = await bet.getMinimumBet()
    //         assert.equal(FEE_OWNER * 10_000_000_000_000, betFee.toString()) // "0" : OPEN "1" : CALCULATING
    //         assert.equal(BET_PRICE, minBet.toString())
    //         assert.equal(await bet.getWinner(), "0")
    //         assert.equal(await bet.getSmartContractState(), "0")
    //     })
    // })

    // BET
    console.log("BET...")
    betTemp = await ethers.getContract("Bet", deployer)
    accounts = await ethers.getSigners()
    acc1 = betTemp.connect(accounts[0])
    acc2 = betTemp.connect(accounts[1])
    acc3 = betTemp.connect(accounts[2])

    console.log("bet of : ", accounts[0].address)
    const tx1 = await acc1.toBet(1, { value: BET_PRICE })
    console.log("bet of : ", accounts[1].address)
    const tx2 = await acc2.toBet(2, { value: BET_PRICE })
    console.log("bet of : ", accounts[2].address)
    const tx3 = await acc3.toBet(3, { value: BET_PRICE })

    console.log("Bet.sol bet")
    console.log("Wait : ", Math.trunc(Date.now() * 0.001) - (timeout + matchTimestamp))
    await tx1.wait(1)
    await tx2.wait(1)
    await tx3.wait(1)
    delay(1000) // 10 sec

    // describe("Bet initialisation", async function () {
    //     it("Check bet initialisation", async () => {
    //         await assert.equal(await bet.getAddressToAmountBetOnHome(acc1), BET_PRICE.toString())
    //         await assert.equal(await bet.getAddressToAmountBetOnAway(acc2), BET_PRICE.toString())
    //         await assert.equal(await bet.getAddressToAmountBetOnDraw(acc3), BET_PRICE.toString())

    //         await assert.equal(await bet.getNumberOfPlayersWhoBetHome(), "1")
    //         await assert.equal(await bet.getNumberOfPlayersWhoBetAway(), "1")
    //         await assert.equal(await bet.getNumberOfPlayersWhoBetDraw(), "1")

    //         await assert.equal(await bet.getHomeBetAmount(), BET_PRICE.toString())
    //         await assert.equal(await bet.getAwayBetAmount(), BET_PRICE.toString())
    //         await assert.equal(await bet.getDrawBetAmount(), BET_PRICE.toString())
    //     })
    // })
    console.log("Wait : ", Math.trunc(Date.now() * 0.001) - (timeout + matchTimestamp))

    // upkeep
    console.log("Upkeeper simulation...")
    const upkeepNeeded = false

    while (1) {
        upkeepNeeded = false
        console.log("Wait : ", Math.trunc(Date.now() * 0.001) - (timeout + matchTimestamp))
        await delay(10000)
        console.log("Test upkeep.")
        // try {
        const { upkeepNeeded } = await bet.callStatic.checkUpkeep([])
        // } catch {}
        if (upkeepNeeded) {
            console.log("performUpkeep...")
            await (await bet.performUpkeep("0x")).wait(1)
            break
        }
    }
    // delay(10000) // 10 sec

    // describe("Bet result", async function () {
    //     it("Check bet Draw win", async () => {
    //         await assert.equal(1, 2)
    //     })
    // })
}

// yarn hardhat run scripts/betTest.js --network goerli
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
