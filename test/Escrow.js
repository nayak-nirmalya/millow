const { expect } = require('chai')
const { ethers } = require('hardhat')

const IPFS_URL =
  'https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS'

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
  let buyer, seller, inspector, lender
  let realEstate, escrow

  beforeEach(async () => {
    ;[buyer, seller, inspector, lender] = await ethers.getSigners()

    // Deploy Real Estate
    const RealEstate = await ethers.getContractFactory('RealEstate')
    realEstate = await RealEstate.deploy()

    // Mint
    let transaction = await realEstate.connect(seller).mint(IPFS_URL)
    await transaction.wait()

    // Deploy Escrow
    const Escrow = await ethers.getContractFactory('Escrow')
    escrow = await Escrow.deploy(
      realEstate.address,
      seller.address,
      inspector.address,
      lender.address,
    )

    // Approve Property
    transaction = await realEstate.connect(seller).approve(escrow.address, 1)
    await transaction.wait()

    // List Property
    transaction = await escrow.connect(seller).list(1)
    await transaction.wait()
  })

  describe('Deployment', () => {
    it('returns NFT address', async () => {
      const result = await escrow.nftAddress()
      expect(result).to.be.equal(realEstate.address)
    })

    it('returns seller address', async () => {
      const result = await escrow.seller()
      expect(result).to.be.equal(seller.address)
    })

    it('returns inspector address', async () => {
      const result = await escrow.inspector()
      expect(result).to.be.equal(inspector.address)
    })

    it('returns lender address', async () => {
      const result = await escrow.lender()
      expect(result).to.be.equal(lender.address)
    })
  })

  describe('Listing', () => {
    it('transfers ownership', async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address)
    })
  })
})
