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

const BET_PRICE = ethers.utils.parseEther("0.1")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Bet Unit Tests", async function () {
          let bet, linkToken, mockOracle, deployer, accounts, accConnection1, accConnection2, testBalanceConsistency, txr

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer

              chainId = network.config.chainId
              await deployments.fixture(["all"])
              linkToken = await ethers.getContract("LinkToken")
              linkTokenAddress = linkToken.address
              additionalMessage = ` --linkaddress  ${linkTokenAddress}`
              bet = await ethers.getContract("Bet", deployer)
              mockOracle = await ethers.getContract("MockOracle")
              timeout = await bet.getTimeout()
              accounts = await ethers.getSigners()

              accConnection1 = bet.connect(accounts[1])
              accConnection2 = bet.connect(accounts[2])
              accConnection3 = bet.connect(accounts[3])

              await hre.run("fund-link", { contract: bet.address, linkaddress: linkTokenAddress })
          })
          describe("Constructor", function () {
              it("Check vars initialisation", async () => {
                  const betFee = await bet.getFee()
                  const minBet = await bet.getMinimumBet()
                  assert.equal(FEE_OWNER, betFee.toString()) // "0" : OPEN "1" : CALCULATING
                  assert.equal(TIMEOUT, timeout.toString())
                  assert.equal(MINIMUM_BET, minBet.toString())
                  assert.equal(await bet.getWinner(), "0")
                  assert.equal(await bet.getSmartContractState(), "0")
              })
          })

          describe("Enter a bet", function () {
              it("Revert when you don't pay enough", async function () {
                  await expect(bet.toBet(1, { value: MINIMUM_BET - 1 })).to.be.revertedWith("Bet__SendMoreEth")
              })
              it("Check variable home bet + event", async function () {
                  const tx = await bet.toBet(1, { value: MINIMUM_BET })
                  const txr = await tx.wait(1)
                  await assert.equal(await bet.getAddressToAmountBetOnHome(deployer), MINIMUM_BET.toString())
                  await assert.equal(await bet.getNumberOfPlayersWhoBetHome(), "1")
                  await assert.equal(await bet.getHomeBetAmount(), MINIMUM_BET.toString())
                  const ms = txr.events[0].args.ms
                  const playerAdrr = txr.events[0].args.playerAdrr
                  await assert.equal(ms.toString(), "1")
                  await assert.equal(playerAdrr.toString(), deployer.toString())
                  await assert.equal(
                      (await bet.getContractBalance()).toString(),
                      (
                          await bet.getHomeBetAmount()
                      )
                          .add(await bet.getAwayBetAmount())
                          .add(await bet.getDrawBetAmount())
                          .toString()
                  )
              })
              it("Check variable away bet + other connection", async function () {
                  await bet.toBet(2, { value: BET_PRICE })
                  const tx = await accConnection1.toBet(2, { value: BET_PRICE })
                  const txr = await tx.wait(1)
                  await assert.equal(await bet.getAddressToAmountBetOnAway(accounts[1].address), BET_PRICE.toString())
                  await assert.equal(await bet.getNumberOfPlayersWhoBetAway(), "2")
                  await assert.equal(await bet.getAwayBetAmount(), (BET_PRICE * 2).toString())
              })
              it("Check variable draw bet", async function () {
                  await bet.toBet(3, { value: MINIMUM_BET })
                  await assert.equal(await bet.getAddressToAmountBetOnDraw(deployer), MINIMUM_BET.toString())
                  await assert.equal(await bet.getNumberOfPlayersWhoBetDraw(), "1")
                  await assert.equal(await bet.getDrawBetAmount(), MINIMUM_BET.toString())
                  await assert.equal(
                      (await bet.getContractBalance()).toString(),
                      (
                          await bet.getHomeBetAmount()
                      )
                          .add(await bet.getAwayBetAmount())
                          .add(await bet.getDrawBetAmount())
                          .toString()
                  )
              })
          })

          describe("Cancel bet", function () {
              beforeEach(async () => {
                  const tx1 = await bet.toBet(1, { value: BET_PRICE })
                  const tx2 = await accConnection1.toBet(1, { value: BET_PRICE })
                  const tx3 = await accConnection2.toBet(3, { value: BET_PRICE })

                  const txr = await tx3.wait(1)
              })

              it("Revert zero balance", async function () {
                  await expect(accConnection3.cancelBet()).to.be.revertedWith("Bet__ZeroBalance")
              })
              it("Reset balance", async function () {
                  await assert.equal(
                      (await bet.getContractBalance()).toString(),
                      (
                          await bet.getHomeBetAmount()
                      )
                          .add(await bet.getAwayBetAmount())
                          .add(await bet.getDrawBetAmount())
                          .toString()
                  )
                  await assert.equal(await bet.getAddressToAmountBetOnHome(deployer), BET_PRICE.toString())
                  await (await bet.cancelBet()).wait(1)
                  await assert.equal(await bet.getAddressToAmountBetOnHome(deployer), "0")
                  await assert.equal(await bet.getHomeBetAmount(), BET_PRICE.toString())
                  await assert.equal(await bet.getAddressToAmountBetOnHome(accounts[1].address), BET_PRICE.toString())
                  await assert.equal(
                      (await bet.getContractBalance()).toString(),
                      (
                          await bet.getHomeBetAmount()
                      )
                          .add(await bet.getAwayBetAmount())
                          .add(await bet.getDrawBetAmount())
                          .toString()
                  )
              })
              it("Reset all", async function () {
                  await assert.equal(
                      (await bet.getContractBalance()).toString(),
                      (
                          await bet.getHomeBetAmount()
                      )
                          .add(await bet.getAwayBetAmount())
                          .add(await bet.getDrawBetAmount())
                          .toString()
                  )
                  await (await bet.cancelBet()).wait(1)
                  await (await accConnection2.cancelBet()).wait(1)
                  await (await accConnection1.cancelBet()).wait(1)
                  await assert.equal(await bet.getHomeBetAmount(), "0")
                  await assert.equal(await bet.getAwayBetAmount(), "0")
                  await assert.equal(await bet.getDrawBetAmount(), "0")
                  await assert.equal(await bet.getContractBalance(), "0")

                  await assert.equal(
                      (await bet.getContractBalance()).toString(),
                      (
                          await bet.getHomeBetAmount()
                      )
                          .add(await bet.getAwayBetAmount())
                          .add(await bet.getDrawBetAmount())
                          .toString()
                  )
              })
              it("Test event", async function () {
                  const txt = await (await accConnection2.cancelBet()).wait(1)
                  const playerAdrr = txt.events[0].args.playerAdrr
                  assert.equal(playerAdrr, accounts[2].address)
              })
          })

          describe("Test upkeep", function () {
              it("Test only timestamp = true", async function () {
                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT + 1] })
                  await network.provider.request({ method: "evm_mine", params: [] })
                  // callStatic permit to simulate the transaction without really sending it
                  const { upkeepNeeded } = await bet.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })

              it("Test the time : should be false", async function () {
                  await bet.toBet(1, { value: BET_PRICE })
                  await bet.toBet(2, { value: BET_PRICE })
                  await (await bet.toBet(3, { value: BET_PRICE })).wait(1)

                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT * 2 - 10] })
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await bet.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })

              it("Should be upkeep needed", async function () {
                  await bet.toBet(1, { value: BET_PRICE })
                  await bet.toBet(2, { value: BET_PRICE })
                  await (await bet.toBet(3, { value: BET_PRICE })).wait(1)

                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT * 2] })
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await bet.callStatic.checkUpkeep([])
                  assert(upkeepNeeded)
              })
          })
          describe("Test performUpkeep", function () {
              it("Test if performUpkeep can be call without upkeepNeeded", async () => {
                  await bet.toBet(1, { value: BET_PRICE })
                  await bet.toBet(2, { value: BET_PRICE })
                  await (await bet.toBet(3, { value: BET_PRICE })).wait(1)

                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT * 2 - 100] })
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await bet.callStatic.checkUpkeep([])

                  expect(bet.performUpkeep("0x")).to.be.revertedWith("Bet__UpkeepNotNeeded")
              })
              it("Can only run if checkupkeep is true", async () => {
                  await bet.toBet(1, { value: BET_PRICE })
                  await bet.toBet(2, { value: BET_PRICE })
                  await (await bet.toBet(3, { value: BET_PRICE })).wait(1)
                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT * 2 + 100] })
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await bet.callStatic.checkUpkeep([])
                  const tx = await bet.performUpkeep("0x")

                  assert(tx)
              })
          })
          describe("Test requestWinnerData", function () {
              beforeEach(async () => {
                  await bet.toBet(1, { value: BET_PRICE })
                  await bet.toBet(2, { value: BET_PRICE })
                  await (await bet.toBet(3, { value: BET_PRICE })).wait(1)
                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT * 2 + 100] })
                  await network.provider.request({ method: "evm_mine", params: [] })
                  await (await bet.performUpkeep("0x")).wait(1)
              })
              it("Should successfully make an API request", async () => {
                  const tx = await bet.requestWinnerData()
                  const txr = await tx.wait(1)
                  const requestId = txr.events[0].args.id
                  expect(requestId).to.not.be.null
              })

              it("Should successfully make an API request and get a result HOME", async () => {
                  const tx = await bet.requestWinnerData()
                  const txr = await tx.wait(1)
                  const requestId = txr.events[0].args.id
                  const callbackValue = 1 // HOME win
                  await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                  assert.equal(await bet.getSmartContractState(), "2")
                  assert.equal(await bet.getWinner(), "1")
              })
              it("Should successfully make an API request and get a result AWAY", async () => {
                  const tx = await bet.requestWinnerData()
                  const txr = await tx.wait(1)
                  const requestId = txr.events[0].args.id
                  const callbackValue = 2 // HOME win
                  await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                  assert.equal(await bet.getSmartContractState(), "2")
                  assert.equal(await bet.getWinner(), "2")
              })
              it("Should successfully make an API request and get a result DRAW", async () => {
                  const tx = await bet.requestWinnerData()
                  const txr = await tx.wait(1)
                  const requestId = txr.events[0].args.id
                  const callbackValue = 3 // HOME win
                  await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                  assert.equal(await bet.getSmartContractState(), "2")
                  assert.equal(await bet.getWinner(), "3")
              })
              it("Should successfully make an API request and get a result CANCEL", async () => {
                  const tx = await bet.requestWinnerData()
                  const txr = await tx.wait(1)
                  const requestId = txr.events[0].args.id
                  const callbackValue = 4 // HOME win
                  await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                  assert.equal(await bet.getSmartContractState(), "3")
                  assert.equal(await bet.getWinner(), "3")
              })
          })

          //   it("Our event should successfully fire event on callback", async () => {
          //       const callbackValue = 777
          //       // we setup a promise so we can wait for our callback from the `once` function
          //       await new Promise(async (resolve, reject) => {
          //           // setup listener for our event
          //           apiConsumer.once("DataFullfilled", async () => {
          //               console.log("DataFullfilled event fired!")
          //               const volume = await apiConsumer.volume()
          //               // assert throws an error if it fails, so we need to wrap
          //               // it in a try/catch so that the promise returns event
          //               // if it fails.
          //               try {
          //                   assert.equal(volume.toString(), callbackValue.toString())
          //                   resolve()
          //               } catch (e) {
          //                   reject(e)
          //               }
          //           })
          //           const transaction = await apiConsumer.requestVolumeData()
          //           const transactionReceipt = await transaction.wait(1)
          //           const requestId = transactionReceipt.events[0].topics[1]
          //           await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
          //       })
          //   })
      })