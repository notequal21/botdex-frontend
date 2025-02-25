/* eslint-disable */
import BigNumber from 'bignumber.js/bignumber';
import { Observable } from 'rxjs';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import rootStore from '@/store';
import { contracts } from '@/config';
import { clog } from '@/utils/logger';

declare global {
  interface Window {
    ethereum: any;
  }
}
interface INetworks {
  [key: string]: string;
}

interface IMetamaskService {
  testnet: 'ropsten' | 'kovan' | 'rinkeby' | 'bsct' | 'polygont';
  isProduction?: boolean;
}

interface IChain {
  chainId: string;
  rpcUrls: string[];
  chainName: string;
  blockExplorerUrls: string[];
  nativeCurrency: INativeCurrency;
}
interface IChains {
  [key: string]: IChain;
}
interface INativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

const chainsParams: IChains = {
  // '0x1': {
  //   chainId: '0x1',
  //   rpcUrl: 'https://mainnet.infura.io/v3/93bd9cedc55f4d1c817829728897ea08',
  //   name: 'Ethereum Mainnet',
  //   blockExp: 'https://etherscan.io/',
  // },
  // '0x3': {
  //   chainId: '0x3',
  //   rpcUrl: 'https://ropsten.infura.io/v3/93bd9cedc55f4d1c817829728897ea08',
  //   name: 'Ropsten',
  //   blockExp: 'https://ropsten.etherscan.io/',
  // },
  // '0x2a': {
  //   chainId: '0x2a',
  //   rpcUrl: 'https://kovan.infura.io/v3/93bd9cedc55f4d1c817829728897ea08',
  //   name: 'Kovan',
  //   blockExp: 'https://kovan.etherscan.io/',
  // },
  // '0x4': {
  //   chainId: '0x4',
  //   rpcUrl: 'https://rinkeby.infura.io/v3/93bd9cedc55f4d1c817829728897ea08',
  //   name: 'Rinkeby',
  //   blockExp: 'https://rinkeby.etherscan.io/',
  // },
  '0x61': {
    chainId: '0x61',
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    chainName: 'Binance Testnet',
    blockExplorerUrls: ['https://testnet.bscscan.com'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  '0x38': {
    chainId: '0x38',
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    chainName: 'Binance Mainnet',
    blockExplorerUrls: ['https://bscscan.com/'],
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  },
  '0x89': {
    chainId: '0x89',
    rpcUrls: ['https://rpc-mainnet.maticvigil.com'],
    chainName: 'Polygon Mainnet',
    blockExplorerUrls: ['https://polygonscan.com/'],
    nativeCurrency: { name: 'POLYGON', decimals: 18, symbol: 'POLYGON' },
  },
  '0x13881': {
    chainId: '0x13881',
    rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
    chainName: 'Polygon Testnet',
    blockExplorerUrls: ['https://explorer-mumbai.maticvigil.com/'],
    nativeCurrency: { name: 'POLYGON', decimals: 18, symbol: 'MATIC' },
  },
};

const networks: INetworks = {
  mainnet: '0x38' || '0x89',
  mainnet2: '0x89', // polygon
  ropsten: '0x3',
  kovan: '0x2a',
  rinkeby: '0x4',
  bsct: '0x61',
  bsc: '0x38',
  polygont: '0x13881',
};

export default class MetamaskService {
  public wallet;

  public web3Provider;

  private readonly testnet: string;

  private readonly isProduction: boolean;

  public walletAddress = '';

  public chainChangedObs: any;

  public accountChangedObs: any;

  public usedNetwork: string;

  public usedChain: string[];

  public contracts: any = {};

  constructor({ testnet, isProduction = false }: IMetamaskService) {
    this.wallet = window.ethereum;
    this.web3Provider = new Web3(this.wallet);
    this.testnet = testnet;
    this.isProduction = isProduction;

    this.usedNetwork = this.isProduction ? 'mainnet' : this.testnet;
    this.usedChain = this.isProduction ? [networks.mainnet, networks.mainnet2] : [networks.bsct, networks.polygont];

    this.chainChangedObs = new Observable((subscriber) => {
      if (!this.wallet) {
        return;
      }

      this.wallet.on('chainChanged', () => {
        const currentChain: string = this.wallet.chainId;
        if (!this.usedChain.includes(currentChain)) {
          subscriber.next(`Please choose ${this.usedNetwork} network in metamask wallet.`);
        } else {
          rootStore.modals.metamaskErr.close();
        }
        if (this.usedChain.includes(currentChain)) {
          this.connect();
        }
      });
    });

    this.accountChangedObs = new Observable((subscriber) => {
      if (!this.wallet) {
        return;
      }

      this.wallet.on('accountsChanged', () => {
        subscriber.next();
      });
    });
  }

  ethRequestAccounts(): any {
    return this.wallet.request({ method: 'eth_requestAccounts' });
  }

  async checkNets(chainId = this.wallet.chainId): Promise<boolean> {
    const requiredChain = this.usedChain;
    if (requiredChain.includes(chainId)) {
      try {
        await this.wallet.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainId }],
        });
        return true;
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await this.wallet.request({
              method: 'wallet_addEthereumChain',
              params: [chainsParams[requiredChain[0]]],
            });
            return true;
          } catch (addError: any) {
            clog(addError);
            return false;
          }
        } else {
          clog(switchError);
          return false;
        }
      }
    }
    return false;
  }

  public connect(): Promise<any> {
    if (!this.wallet) {
      return Promise.reject(
        new Error(`Couldn't find Metamask extension, check if it's installed and enabled.`),
      );
    }
    const currentChain = this.wallet.chainId;

    return new Promise((resolve, reject) => {
      if (!this.wallet) {
        reject(new Error(`metamask wallet is not injected`));
      }

      if (!currentChain) {
        this.wallet
          .request({ method: 'eth_chainId' })
          .then((resChain: any) => {
            this.checkNets(resChain).then((required) => {
              if (required) {
                this.ethRequestAccounts()
                  .then((account: any) => {
                    [this.walletAddress] = account;
                    resolve({
                      address: account[0],
                      network: resChain,
                    });
                  })
                  .catch(() => reject(new Error('Not authorized')));
              } else {
                reject(new Error(`Please choose ${this.usedNetwork} network in metamask wallet`));
              }
            });
          })
          .catch(() => reject(new Error('Not authorized')));
      } else {
        this.checkNets().then((required) => {
          if (required) {
            this.ethRequestAccounts()
              .then((account: any) => {
                [this.walletAddress] = account;
                resolve({
                  address: account[0],
                  network: currentChain,
                });
              })
              .catch(() => reject(new Error('Not authorized')));
          } else {
            reject(new Error(`Please choose ${this.usedNetwork} network in metamask wallet.`));
          }
        });
      }
    });
  }

  createContract(contractName: string, tokenAddress: string, abi: Array<any>): void {
    if (!this.contracts[contractName]) {
      const contract = this.getContract(tokenAddress, abi);
      this.contracts = {
        ...this.contracts,
        [contractName]: contract,
      };
    }
  }

  getContract(tokenAddress: string, abi: Array<any>): Contract {
    return new this.web3Provider.eth.Contract(abi, tokenAddress);
  }

  getEthBalance(): any {
    return this.web3Provider.eth.getBalance(this.walletAddress);
  }

  static getMethodInterface(abi: Array<any>, methodName: string): any {
    return abi.filter((m) => {
      return m.name === methodName;
    })[0];
  }

  encodeFunctionCall(abi: any[] | any, data: Array<any>): any {
    return this.web3Provider.eth.abi.encodeFunctionCall(abi, data);
  }

  async totalSupply(tokenAddress: string, abi: Array<any>, tokenDecimals: number): Promise<number> {
    const contract = this.getContract(tokenAddress, abi);
    const totalSupply = await contract.methods.totalSupply().call();

    return +new BigNumber(totalSupply).dividedBy(new BigNumber(10).pow(tokenDecimals)).toString(10);
  }

  async getTokenInfo(
    address: string,
    abi: any[],
  ): Promise<{ name: any; decimals: any; symbol: any; address: any }> {
    try {
      const contract = this.getContract(address, abi);
      const name = await contract.methods.name().call();
      const decimals = await contract.methods.decimals().call();
      const symbol = await contract.methods.symbol().call();

      return {
        name,
        decimals,
        symbol,
        address,
      };
    } catch (err) {
      throw new Error('err get token info');
    }
  }

  async checkTokenAllowance2({
    contractName,
    approvedAddress,
    walletAddress,
    amount,
  }: {
    contractName: 'BOT' | 'BOTDEX_STAKING';
    approvedAddress?: string;
    walletAddress?: string;
    amount?: string | number;
  }): Promise<boolean> {
    try {
      const contract = this.getContract(
        contracts[contractName].ADDRESS,
        contracts[contractName].ABI,
      );
      const walletAdr = walletAddress || this.walletAddress;

      let result = await contract.methods
        .allowance(walletAdr, approvedAddress || contracts[contractName].ADDRESS)
        .call();

      const tokenDecimals = await this.getTokenDecimals(contracts[contractName].ADDRESS);

      result =
        result === '0'
          ? null
          : +new BigNumber(result).dividedBy(new BigNumber(10).pow(tokenDecimals)).toString(10);
      return !!(result && new BigNumber(result).minus(amount || 0).isPositive());
    } catch (error) {
      return false;
    }
  }

  async checkTokenAllowance({
    contractName,
    tokenDecimals,
    approvedAddress,
    walletAddress,
    tokenAddress,
    approveSum,
  }: {
    contractName: 'ROUTER' | 'ERC20' | 'PAIR' | 'BOT' | 'BOTDEX_STAKING';
    tokenDecimals?: number;
    approvedAddress?: string;
    walletAddress?: string;
    tokenAddress: string;
    approveSum?: number;
  }): Promise<boolean> {
    let decimals = NaN;

    const contract = this.getContract(tokenAddress, contracts[contractName].ABI);

    if (!tokenDecimals) {
      const tokenInfo = await this.getTokenInfo(tokenAddress, contracts[contractName].ABI);
      decimals = tokenInfo.decimals;
    }
    const walletAdr = walletAddress || this.walletAddress;

    try {
      let result = await contract.methods.allowance(walletAdr, approvedAddress).call();

      result =
        result === '0'
          ? null
          : +new BigNumber(result)
              .dividedBy(new BigNumber(10).pow(tokenDecimals || decimals))
              .toString(10);
      return !!(result && new BigNumber(result).minus(approveSum || 0).isPositive());
    } catch (error) {
      return false;
    }
  }

  async approveToken({
    contractName,
    approvedAddress,
    walletAddress,
    tokenAddress,
  }: {
    contractName: 'ROUTER' | 'ERC20' | 'PAIR' | 'BOTDEX_STAKING' | 'BOT';
    approvedAddress?: string;
    walletAddress?: string;
    tokenAddress: string;
  }): Promise<any> {
    try {
      const approveMethod = MetamaskService.getMethodInterface(
        contracts[contractName].ABI,
        'approve',
      );
      const approveSignature = this.encodeFunctionCall(approveMethod, [
        approvedAddress || walletAddress || this.walletAddress,
        new BigNumber(2).pow(256).minus(1).toFixed(0, 1),
      ]);
      return this.sendTransaction({
        from: walletAddress || this.walletAddress,
        to: tokenAddress,
        data: approveSignature,
      });
    } catch (error) {
      return error;
    }
  }

  public async getTokenDecimals(address: string): Promise<any> {
    const contract = this.getContract(address, contracts.ERC20.ABI);

    return contract.methods.decimals().call();
  }

  static calcTransactionAmount(amount: number | string, tokenDecimal: number): string {
    return new BigNumber(amount).times(new BigNumber(10).pow(tokenDecimal)).toFixed(0).toString();
  }

  static amountFromGwei(amount: number | string, tokenDecimal: number): string {
    return new BigNumber(amount).dividedBy(new BigNumber(10).pow(tokenDecimal)).toString(10);
  }

  createTransaction({
    method,
    data,
    contractName,
    tx,
    toAddress,
    fromAddress,
    value,
  }: {
    method: string;
    data: Array<any>;
    contractName: 'ROUTER' | 'FACTORY' | 'PAIR';
    tx?: any;
    toAddress?: string;
    fromAddress?: string;
    value?: any;
  }): any {
    const contract = contracts[contractName];
    const { ABI, ADDRESS } = contract;
    const transactionMethod = MetamaskService.getMethodInterface(ABI, method);

    let signature;
    if (transactionMethod.inputs.length) {
      signature = this.encodeFunctionCall(transactionMethod, data);
    }

    if (tx) {
      tx.from = fromAddress || this.walletAddress;
      tx.data = signature;

      return this.sendTransaction(tx);
    }
    return this.sendTransaction({
      from: fromAddress || this.walletAddress,
      to: toAddress || ADDRESS,
      data: signature || '',
      value: value || '',
    });
  }

  signMsg(msg: string): any {
    return this.web3Provider.eth.personal.sign(msg, this.walletAddress, '');
  }

  async callContractMethod(
    contractName: string,
    methodName: string,
    data?: any[],
    contractAddress?: string,
    contractAbi?: Array<any>,
  ): Promise<any> {
    try {
      if (!this.contracts[contractName] && contractAddress && contractAbi) {
        await this.createContract(contractName, contractAddress, contractAbi);
      }

      if (this.contracts[contractName]) {
        const method = await this.contracts[contractName].methods[methodName];
        if (data) {
          return await method(...data).call();
        }
        return await method().call();
      }
    } catch (err: any) {
      throw new Error(err);
    }
    return new Error(`contract ${contractName} didn't created`);
  }

  async callContractMethodFromNewContract(
    contractAddress: string,
    abi: any[],
    methodName: string,
    data?: any[],
  ): Promise<any> {
    try {
      const contract = this.getContract(contractAddress, abi);
      const method = contract.methods[methodName];

      if (data) {
        return await method(...data).call();
      }
      return await method().call();
    } catch (err: any) {
      throw new Error(err);
    }
  }

  sendTransaction(transactionConfig: any | string): any {
    return this.web3Provider.eth.sendTransaction({
      ...transactionConfig,
      from: this.walletAddress,
    });
  }
}
