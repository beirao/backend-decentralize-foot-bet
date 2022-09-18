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
          let bet, linkToken, mockOracle, deployer, accounts, accConnection1, accConnection2, testBalanceConsistency, txr, txr2

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
                  assert.equal(FEE_OWNER * 10_000_000_000_000, betFee.toString()) // "0" : OPEN "1" : CALCULATING
                  assert.equal(TIMEOUT, timeout.toString())
                  assert.equal(MINIMUM_BET, minBet.toString())
                  assert.equal(await bet.getWinner(), "0")
                  assert.equal(await bet.getSmartContractState(), "0")
              })
              it("Test link withdraw", async () => {
                  assert.equal((await linkToken.balanceOf(bet.address)).toString(), ethers.utils.parseEther("2"))
              })
          })
          describe("Enter a bet", function () {
              it("Revert when you don't pay enough + reward reverted", async function () {
                  await expect(bet.toBet(1, { value: MINIMUM_BET - 1 })).to.be.revertedWith("Bet__SendMoreEth")
                  await expect(bet.withdrawReward()).to.be.revertedWith("Bet__PlayersNotFundedYet")
                  await expect(accConnection1.withdrawReward()).to.be.revertedWith("Bet__PlayersNotFundedYet")
                  await expect(bet.getReward()).to.be.revertedWith("Bet__PlayersNotFundedYet")
                  await expect(accConnection1.getReward()).to.be.revertedWith("Bet__PlayersNotFundedYet")
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
                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT + 100] })
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

                  await network.provider.request({ method: "evm_increaseTime", params: [TIMEOUT * 2 + 100] })
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
              describe("Test API EA", function () {
                  it("Should successfully make an API request", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      expect(requestId).to.not.be.null
                  })

                  it("Should successfully make an API request and get a result HOME", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      const callbackValue = 1 // HOME win
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                      assert.equal(await bet.getSmartContractState(), "4")
                      assert.equal(await bet.getWinner(), "1")
                  })
                  it("Should successfully make an API request and get a result AWAY", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      const callbackValue = 2 // AWAY win
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                      assert.equal(await bet.getSmartContractState(), "4")
                      assert.equal(await bet.getWinner(), "2")
                  })
                  it("Should successfully make an API request and get a result DRAW", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      const callbackValue = 3 // DRAW win
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                      assert.equal(await bet.getSmartContractState(), "4")
                      assert.equal(await bet.getWinner(), "3")
                  })
                  it("Should successfully make an API request and get a result CANCEL + check balance consistency", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      const callbackValue = 4 // Match cancel
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))).wait(1)

                      assert.equal(await bet.getSmartContractState(), "5")
                      assert.equal(await bet.getWinner(), "4")
                  })
              })
              describe("Test refundAll", function () {
                  beforeEach(async () => {
                      await accConnection1.toBet(1, { value: BET_PRICE })
                      await accConnection2.toBet(2, { value: BET_PRICE })
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(4))).wait(1) // EA ret 4 => match cancel
                  })
                  it("Test all revert", async () => {
                      await expect(bet.toBet(1, { value: BET_PRICE })).to.be.revertedWith("Bet__MatchStarted")
                      await expect(bet.cancelBet()).to.be.revertedWith("Bet__MatchStarted")
                  })
                  it("Test all balance", async () => {
                      assert.equal(await bet.getHomeBetAmount(), (BET_PRICE * 2).toString())
                      assert.equal(await bet.getAwayBetAmount(), (BET_PRICE * 2).toString())
                      assert.equal(await bet.getDrawBetAmount(), BET_PRICE.toString())
                  })
                  it("Test reward repartion", async () => {
                      assert.equal(await bet.getReward(), (BET_PRICE * 3).toString())
                      assert.equal(await accConnection2.getReward(), BET_PRICE.toString())
                      assert.equal(await accConnection1.getReward(), BET_PRICE.toString())
                  })
                  it("Test link withdraw", async () => {
                      assert.equal((await linkToken.balanceOf(bet.address)).toString(), "0")
                  })
              })
              describe("Test fundWinners", function () {
                  beforeEach(async () => {
                      await accConnection1.toBet(1, { value: BET_PRICE })
                      await accConnection2.toBet(2, { value: BET_PRICE })
                  })
                  it("Test linkk", async () => {
                      assert.equal(
                          (await linkToken.balanceOf(bet.address)).toString(),
                          ethers.utils.parseEther("2") - ethers.utils.parseEther("0.1") /* the bet.performUpkeep("0x") fee */
                      )
                  })
                  it("Test owner taxe", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      const oldDeployerBalance = await accounts[0].getBalance()
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(1))).wait(1) // EA ret 3 => draw win

                      console.log("oldDeployerBalance ", oldDeployerBalance.toString())
                      console.log("newDeployerBalance ", (await accounts[0].getBalance()).toString())

                      assert.isTrue(oldDeployerBalance < (await accounts[0].getBalance()))
                  })
                  it("Test home win", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(1))).wait(1) // EA ret 1 => home win

                      assert.equal((await bet.getReward()).toString(), ((BET_PRICE * 5 * (1 - FEE_OWNER)) / 2).toString())
                      assert.equal(
                          (await accConnection1.getReward()).toString(),
                          ((BET_PRICE * 5 * (1 - FEE_OWNER)) / 2).toString()
                      )
                      assert.equal((await accConnection2.getReward()).toString(), "0")
                  })
                  it("Test away win", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(2))).wait(1) // EA ret 2 => away win

                      assert.equal((await bet.getReward()).toString(), ((BET_PRICE * 5 * (1 - FEE_OWNER)) / 2).toString())
                      assert.equal((await accConnection1.getReward()).toString(), "0")
                      assert.equal(
                          (await accConnection2.getReward()).toString(),
                          ((BET_PRICE * 5 * (1 - FEE_OWNER)) / 2).toString()
                      )
                  })
                  it("Test draw win", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(3))).wait(1) // EA ret 3 => draw win

                      assert.equal((await bet.getReward()).toString(), (BET_PRICE * 5 * (1 - FEE_OWNER)).toString())
                      assert.equal((await accConnection1.getReward()).toString(), "0")
                      assert.equal((await accConnection2.getReward()).toString(), "0")
                  })
                  it("Test erroned value refundAll", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(6))).wait(1) // EA ret 3 => draw win

                      assert.equal((await bet.getReward()).toString(), BET_PRICE * 3)
                      assert.equal((await accConnection1.getReward()).toString(), BET_PRICE)
                      assert.equal((await accConnection2.getReward()).toString(), BET_PRICE)
                  })
                  it("Test link withdraw", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(2))).wait(1) // EA ret 2 => away win
                      assert.equal((await linkToken.balanceOf(bet.address)).toString(), "0")
                  })
              })
              describe("Test withdrawReward", function () {
                  beforeEach(async () => {
                      await accConnection1.toBet(1, { value: BET_PRICE })
                      await accConnection2.toBet(2, { value: BET_PRICE })
                  })
                  it("Test home win", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(1))).wait(1)
                      // EA ret 1 => home win

                      await bet.withdrawReward()
                      await accConnection1.withdrawReward()
                      await expect(accConnection2.withdrawReward()).to.be.revertedWith("Bet__NoReward")

                      assert.equal((await bet.getContractBalance()).toString(), "0")
                  })
                  it("Test away win", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(2))).wait(1)
                      // EA ret 1 => home win

                      await bet.withdrawReward()
                      await expect(accConnection1.withdrawReward()).to.be.revertedWith("Bet__NoReward")
                      await accConnection2.withdrawReward()

                      assert.equal((await bet.getContractBalance()).toString(), "0")
                  })
                  it("Test draw win", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(3))).wait(1)
                      // EA ret 1 => home win

                      await bet.withdrawReward()
                      await expect(accConnection1.withdrawReward()).to.be.revertedWith("Bet__NoReward")
                      await expect(accConnection2.withdrawReward()).to.be.revertedWith("Bet__NoReward")

                      assert.equal((await bet.getContractBalance()).toString(), "0")
                  })
                  it("Test cancel", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(4))).wait(1)
                      // EA ret 1 => home win

                      await bet.withdrawReward()
                      await accConnection1.withdrawReward()
                      await accConnection2.withdrawReward()

                      assert.equal((await bet.getContractBalance()).toString(), "0")
                  })
                  it("Test erroned value refundAll", async () => {
                      const tx = await bet.performUpkeep("0x")
                      const txr = await tx.wait(1)
                      const requestId = txr.events[0].args.id
                      await (await mockOracle.fulfillOracleRequest(requestId, numToBytes32(40))).wait(1)
                      // EA ret 1 => home win

                      await bet.withdrawReward()
                      await accConnection1.withdrawReward()
                      await accConnection2.withdrawReward()

                      assert.equal((await bet.getContractBalance()).toString(), "0")
                  })
              })
          })
      })
//   it("Test all revert", async () => {
//     await expect(bet.withdrawReward()).to.be.revertedWith("Bet__MatchNotEnded")
//     await expect(accConnection1.withdrawReward()).to.be.revertedWith("Bet__MatchNotEnded")
// })
