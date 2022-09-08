const FEE_OWNER = 200_000_000_000 / 10_000_000_000_000 // %  // fees deducted from the total balance of bets
const MINIMUM_BET = 10000000000000 // 0.00001 eth
const TIMEOUT = 24 * 60 * 60 // 1 jour

const networkConfig = {
    default: {
        name: "hardhat",
        fee: "100000000000000000",
        keyHash: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        jobId: "29fa9aa13bf1468788b7cc4a500a45b8",
        fundAmount: "1000000000000000000",
        registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
        registrarAddress: "0xDb8e8e2ccb5C033938736aa89Fe4fa1eDfD15a1d",
        keepersUpdateInterval: "30",
    },
    31337: {
        name: "localhost",
        fee: "100000000000000000",
        keyHash: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        jobId: "29fa9aa13bf1468788b7cc4a500a45b8",
        fundAmount: "1000000000000000000",
        registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
        registrarAddress: "0xDb8e8e2ccb5C033938736aa89Fe4fa1eDfD15a1d",
        ethUsdPriceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    },
    42: {
        name: "kovan",
        linkToken: "0xa36085F69e2889c224210F603D836748e7dC0088",
        ethUsdPriceFeed: "0x9326BFA02ADD2366b30bacB125260Af641031331",
        oracle: "0x74EcC8Bdeb76F2C6760eD2dc8A46ca5e581fA656",
        jobId: "c1c5e92880894eb6b27d3cae19670aa3", // get > bool
        fundAmount: "100000000000000000", // 0.1
        fee: "100000000000000000",
        registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
        registrarAddress: "0xDb8e8e2ccb5C033938736aa89Fe4fa1eDfD15a1d",
    },
    4: {
        name: "rinkeby",
        linkToken: "0x01be23585060835e02b77ef475b0cc51aa1e0709",
        ethUsdPriceFeed: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
        keyHash: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        vrfCoordinator: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
        oracle: "0xf3FBB7f3391F62C8fe53f89B41dFC8159EE9653f",
        jobId: "c1c5e92880894eb6b27d3cae19670aa3", // get > bool
        fundAmount: "100000000000000000", // 0.1
        fee: "100000000000000000",
        registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
        registrarAddress: "0xDb8e8e2ccb5C033938736aa89Fe4fa1eDfD15a1d",
    },
    1: {
        name: "mainnet",
        linkToken: "0x514910771af9ca656af840dff83e8264ecf986ca",
        fundAmount: "0",
        registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
        registrarAddress: "0xDb8e8e2ccb5C033938736aa89Fe4fa1eDfD15a1d",
    },
    5: {
        name: "goerli",
        linkToken: "0x326c977e6efc84e512bb9c30f76e30c160ed06fb",
        registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
        registrarAddress: "0x9806cf6fBc89aBF286e8140C42174B94836e36F2",
        fundAmount: "0",
        fee: "100000000000000000",
    },
    137: {
        name: "polygon",
        linkToken: "0xb0897686c545045afc77cf20ec7a532e3120e0f1",
        ethUsdPriceFeed: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
        oracle: "0x0a31078cd57d23bf9e8e8f1ba78356ca2090569e",
        jobId: "12b86114fa9e46bab3ca436f88e1a912",
        fee: "100000000000000",
        fundAmount: "100000000000000",
        registryAddress: "0x02777053d6764996e594c3E88AF1D58D5363a2e6",
        registrarAddress: "0xDb8e8e2ccb5C033938736aa89Fe4fa1eDfD15a1d",
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    FEE_OWNER, // % * 10⁵ basis points // fees deducted from the total balance of bets
    MINIMUM_BET, // 0.00001 eth
    TIMEOUT, // 1 jour
}
