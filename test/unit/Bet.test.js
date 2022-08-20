const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { numToBytes32 } = require("@chainlink/test-helpers/dist/src/helpers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Bet Unit Tests", async function () {
          let bet, linkToken, mockOracle

          beforeEach(async () => {
              chainId = network.config.chainId
              await deployments.fixture(["all"])
              linkToken = await ethers.getContract("LinkToken")
              linkTokenAddress = linkToken.address
              additionalMessage = ` --linkaddress  ${linkTokenAddress}`
              bet = await ethers.getContract("Bet")
              mockOracle = await ethers.getContract("MockOracle")
              timeout = await bet.getTimeout()

              await hre.run("fund-link", { contract: bet.address, linkaddress: linkTokenAddress })
          })

          it("Check vars initialisation", async () => {
              const betFee = await bet.getFee()
              assert.equal(networkConfig[chainId]["fee"], betFee.toString()) // "0" : OPEN "1" : CALCULATING
              assert.equal(networkConfig[chainId]["timeout"], timeout.toString())
          })

          //   it("Should successfully make an API request", async () => {
          //       const transaction = await apiConsumer.requestVolumeData()
          //       const transactionReceipt = await transaction.wait(1)
          //       const requestId = transactionReceipt.events[0].topics[1]
          //       console.log("requestId: ", requestId)
          //       expect(requestId).to.not.be.null
          //   })

          //   it("Should successfully make an API request and get a result", async () => {
          //       const transaction = await apiConsumer.requestVolumeData()
          //       const transactionReceipt = await transaction.wait(1)
          //       const requestId = transactionReceipt.events[0].topics[1]
          //       const callbackValue = 777
          //       await mockOracle.fulfillOracleRequest(requestId, numToBytes32(callbackValue))
          //       const volume = await apiConsumer.volume()
          //       assert.equal(volume.toString(), callbackValue.toString())
          //   })

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
