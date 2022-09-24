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

const BET_PRICE = ethers.utils.parseEther("0.001")
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
    // describe("Upkeeper simulation...", async function () {
    //     it("Check bet result DRAW win", async () => {
    const { deployer } = await getNamedAccounts()
    bet = await ethers.getContract("Bet", deployer)
    accounts = await ethers.getSigners()

    assert.equal((await bet.getReward(accounts[0].address)).toString(), "0")
    assert.equal((await bet.getReward(accounts[1].address)).toString(), "0")
    assert.equal((await bet.getReward(accounts[2].address)).toString(), (BET_PRICE * 3 * (1 - FEE_OWNER)).toString())
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
