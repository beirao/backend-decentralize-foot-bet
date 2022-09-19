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

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Bet Unit Tests", async function () {
          let bet, linkToken, deployer, accounts, accConnection1, accConnection2

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer

              chainId = network.config.chainId
              //   linkToken = await ethers.getContract("LinkToken")
              //   linkTokenAddress = linkToken.address
              //   additionalMessage = ` --linkaddress ${linkTokenAddress}`
              bet = await ethers.getContract("Bet", deployer)
              timeout = await bet.getTimeout()
          })
          it("Check vars initialisation", async () => {
              const betFee = await bet.getFee()
              const minBet = await bet.getMinimumBet()
              assert.equal(FEE_OWNER * 10_000_000_000_000, betFee.toString()) // "0" : OPEN "1" : CALCULATING
              assert.equal(MINIMUM_BET, minBet.toString())
              assert.equal(await bet.getWinner(), "0")
              assert.equal(await bet.getSmartContractState(), "0")
          })
          //   describe("Go", async function () {
          //       beforeEach(async () => {
          //           accounts = await ethers.getSigners()
          //           accConnection1 = bet.connect(accounts[1])
          //           accConnection2 = bet.connect(accounts[2])
          //           accConnection3 = bet.connect(accounts[3])

          //           await bet.toBet(1, { value: BET_PRICE })
          //           //   await bet.toBet(2, { value: BET_PRICE })
          //           //   await bet.toBet(3, { value: BET_PRICE })
          //           await accConnection1.toBet(2, { value: BET_PRICE })
          //           //   await accConnection2.toBet(3, { value: BET_PRICE })
          //           const tx = await accConnection2.toBet(3, { value: BET_PRICE })
          //           const txr = await tx.wait(1)
          //       })
          //       it("Check vars initialisation", async () => {

          //       })
          //   })
      })
