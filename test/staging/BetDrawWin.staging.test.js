const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    FEE_OWNER,
    MINIMUM_BET,
    TIMEOUT,
} = require("../../helper-hardhat-config")
const { numToBytes32 } = require("@chainlink/test-helpers/dist/src/helpers")
const { autoFundCheck, verify } = require("../../helper-functions")

const BET_PRICE = ethers.utils.parseEther("0.001")
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// yarn hardhat test --network goerli
developmentChains.includes(network.name)
    ? describe.skip
    : describe("STAGING TEST BET | DRAW WIN", async function () {
          let bet, deployer, accounts, matchTimestamp, timeout, acc1, acc2, acc3, betTemp
          before(async () => {
              const matchId = "777" // DRAW

              const { deploy, log, get } = deployments
              const { deployer } = await getNamedAccounts()
              const chainId = network.config.chainId
              let linkTokenAddress, timeout, apiUrl
              let matchTimestamp
              let oracle
              let additionalMessage = ""
              //set log level to ignore non errors
              ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR)

              timeout = 20 // 20 sec
              matchTimestamp = Math.trunc(Date.now() * 0.001) + 8 * 60 // 8 minutes
              //matchTimestamp = 1663902162
              apiUrl = process.env.API_URL
              linkTokenAddress = networkConfig[chainId]["linkToken"]
              oracle = networkConfig[chainId]["oracle"]

              log("deployer : ", deployer)
              log("linkTokenAddress : ", linkTokenAddress)

              const jobId = ethers.utils.toUtf8Bytes(networkConfig[chainId]["jobId"])
              const requestFee = networkConfig[chainId]["requestFee"]
              const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS
              console.log("Wait : ", Math.trunc(Date.now() * 0.001) - matchTimestamp)

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
              console.log("Wait : ", Math.trunc(Date.now() * 0.001) - matchTimestamp)

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
              console.log("Wait : ", Math.trunc(Date.now() * 0.001) - matchTimestamp)
          })
          describe("initialisation", async function () {
              it("Check vars initialisation", async () => {
                  bet = await ethers.getContract("Bet", deployer)
                  const betFee = await bet.getFee()
                  const minBet = await bet.getMinimumBet()
                  assert.equal(FEE_OWNER * 10_000_000_000_000, betFee.toString())
                  assert.equal(MINIMUM_BET, minBet.toString())
                  assert.equal(await bet.getWinner(), "0")
                  assert.equal(await bet.getSmartContractState(), "0")
              })
              describe("Bettor bet", async function () {
                  let acc1, acc2, acc3, bet
                  before(async () => {
                      // BET
                      bet = await ethers.getContract("Bet", deployer)
                      console.log("BET...")
                      accounts = await ethers.getSigners()
                      acc1 = bet.connect(accounts[0])
                      acc2 = bet.connect(accounts[1])
                      acc3 = bet.connect(accounts[2])

                      console.log("bet of : ", accounts[0].address)
                      const tx1 = await acc1.toBet(1, { value: BET_PRICE })
                      console.log("bet of : ", accounts[1].address)
                      const tx2 = await acc2.toBet(2, { value: BET_PRICE })
                      console.log("bet of : ", accounts[2].address)
                      const tx3 = await acc3.toBet(3, { value: BET_PRICE })

                      console.log("Bet.sol bet")
                      console.log("Wait : ", Math.trunc(Date.now() * 0.001) - matchTimestamp)
                      await tx1.wait(1)
                      await tx2.wait(1)
                      await tx3.wait(1)
                      console.log("Wait : ", Math.trunc(Date.now() * 0.001) - matchTimestamp)
                  })
                  it("Check bet initialisation", async () => {
                      await assert.equal(await bet.getNumberOfPlayersWhoBetHome(), "1")
                      await assert.equal(await bet.getNumberOfPlayersWhoBetAway(), "1")
                      await assert.equal(await bet.getNumberOfPlayersWhoBetDraw(), "1")

                      await assert.equal(await bet.getHomeBetAmount(), BET_PRICE.toString())
                      await assert.equal(await bet.getAwayBetAmount(), BET_PRICE.toString())
                      await assert.equal(await bet.getDrawBetAmount(), BET_PRICE.toString())
                  })
                  describe("Upkeeper simulation...", async function () {
                      let deployer, bet, accounts, timeout
                      before(async () => {
                          const { deployer } = await getNamedAccounts()
                          bet = await ethers.getContract("Bet", deployer)
                          accounts = await ethers.getSigners()
                          matchTimestamp = await bet.getMatchTimeStamp()
                          timeout = await bet.getTimeout()

                          while (1) {
                              console.log("Wait : ", Math.trunc(Date.now() * 0.001) - matchTimestamp)
                              await delay(10000)
                              console.log("Test upkeep.")
                              const { upkeepNeeded: upkeepNeededT } = await bet.callStatic.checkUpkeep([])
                              if (upkeepNeededT) {
                                  console.log("performUpkeep...")
                                  await (await bet.performUpkeep("0x")).wait(1)
                                  break
                              } else {
                                  continue
                              }
                          }
                          const confirmationTime = 60000
                          console.log("Still wait : ", confirmationTime)
                          await delay(confirmationTime)
                      })
                      it("Check bet result ", async () => {
                          const { deployer } = await getNamedAccounts()
                          bet = await ethers.getContract("Bet", deployer)
                          accounts = await ethers.getSigners()

                          assert.equal((await bet.getReward(accounts[0].address)).toString(), "0")
                          assert.equal((await bet.getReward(accounts[1].address)).toString(), "0")
                          assert.equal(
                              (await bet.getReward(accounts[2].address)).toString(),
                              (BET_PRICE * 3 * (1 - FEE_OWNER)).toString()
                          )
                      })
                  })
              })
          })
      })
