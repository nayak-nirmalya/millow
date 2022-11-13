const { expect } = require('chai')
const { ethers } = require('hardhat')

const IPFS_URL =
  'https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS'

const tokens = (token) => {
  return ethers.utils.parseUnits(token.toString(), 'ether')
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
    transaction = await escrow
      .connect(seller)
      .list(1, buyer.address, tokens(10), tokens(5))
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
    it('updates as listed', async () => {
      const result = await escrow.isListed(1)
      expect(result).to.be.equal(true)
    })

    it('updates ownership', async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(escrow.address)
    })

    it('returns the correct buyer', async () => {
      const result = await escrow.buyer(1)
      expect(result).to.be.equal(buyer.address)
    })

    it('returns the correct purchase price', async () => {
      const result = await escrow.purchasePrice(1)
      expect(result).to.be.equal(tokens(10))
    })

    it('returns the correct escrow amount', async () => {
      const result = await escrow.escrowAmount(1)
      expect(result).to.be.equal(tokens(5))
    })

    it('fails if anyone except seller call the list method', async () => {
      await expect(
        escrow.connect(lender).list(1, buyer.address, tokens(10), tokens(5)),
      ).to.be.revertedWith('Only seller can call this method')
    })
  })

  describe('Deposits', () => {
    it('updates contract balance', async () => {
      const transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) })
      await transaction.wait()
      const result = await escrow.getBalance()
      expect(result).to.be.equal(tokens(5))
    })
  })

  describe('Inspection', () => {
    it('updates inspection status', async () => {
      const transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true)
      await transaction.wait()
      const result = await escrow.inspectionPassed(1)
      expect(result).to.be.equal(true)
    })
  })

  describe('Approval', () => {
    it('updates approval status', async () => {
      let transaction = await escrow.connect(buyer).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(seller).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(lender).approveSale(1)
      await transaction.wait()

      expect(await escrow.approval(1, buyer.address)).to.be.equal(true)
      expect(await escrow.approval(1, seller.address)).to.be.equal(true)
      expect(await escrow.approval(1, lender.address)).to.be.equal(true)
    })
  })

  describe('Sale', () => {
    beforeEach(async () => {
      let transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) })
      await transaction.wait()

      transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true)
      await transaction.wait()

      transaction = await escrow.connect(buyer).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(seller).approveSale(1)
      await transaction.wait()

      transaction = await escrow.connect(lender).approveSale(1)
      await transaction.wait()

      await lender.sendTransaction({ to: escrow.address, value: tokens(5) })

      transaction = await escrow.connect(seller).finalizeSale(1)
      await transaction.wait()
    })

    it('updates the balance', async () => {
      expect(await escrow.getBalance()).to.be.equal(0)
    })

    it('updates the ownership', async () => {
      expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address)
    })
  })
})
