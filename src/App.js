import Web3 from 'web3';
import React, { useState } from 'react';
import * as Constants from './Constants.js';

function App() {

  // setup state variables for the component
  const [userInfo, setUserInfo] = useState('');
  const [isMetaMaskConnected, setIsMetaMaskConnected] = useState(false);
  const [mintToAddress, setMintToAddress] = useState('');
  const [isMintSuccessful, setIsMintSuccessful] = useState(false)
  const [showUserHistory, setShowUserHistory] = useState('')


  // this method is invoked on click of getUserHistory button. It fetches the the account details, login details and mint events of current wallet address.
  const getUserHistory = async() => {
    try {

      var userHistory = {
        AccountInfo: '',
        LoginInfo: '',
        MintInfo: ''
      };

      // Get user account, login and mint information from database
      var response = await fetch(Constants.API_BASE_URL + '/getuserinfo/' + userInfo.WalletAddress);
      userHistory.AccountInfo = await response.text();

      response = await fetch(Constants.API_BASE_URL + '/getuserlogininfo/' + userInfo.WalletAddress);
      userHistory.LoginInfo = await response.text();

      response = await fetch(Constants.API_BASE_URL + '/getusermints/' + userInfo.WalletAddress);
      userHistory.MintInfo = await response.text();

      setShowUserHistory(userHistory);
    } 
    catch (error) 
    {
      console.error(error);
    }
  }

  // this method is invoked when user successfully logins to metamask. It enters the information into db if the user is new 
  // otherwise it updates the change in the amount of token in user wallet.
  const upsertUserInfo = async (userInfo) => {
    try {
      const response = await fetch(Constants.API_BASE_URL + '/upsertuserinfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userInfo)
      });

      var msg = (response.ok === true)? "Success: upsert user info." : "Fail: upsert user info.";
      console.log(msg);
    } 
    catch (error) 
    {
      console.error(error);
    }
  }

  // this method is invoked when user user starts the mint event or when the mint success event is recieved.
  const upsertMintEvent = async (mintEvent) => {
    try {
      const response = await fetch(Constants.API_BASE_URL + '/upsertmints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mintEvent)
      });

      var msg = (response.ok === true)? "Success: upsert mint info." : "Fail: upsert mint info.";
      console.log(msg);
    } 
    catch (error) 
    {
      console.error(error);
    }
  }

  // this method is invoked when user connects to their metamask wallet
  const connectToMetamask = async () => {
    console.log("Click connect to metamask.");
    try {
      // check if any wallet installed and it is metamask
      if (window.ethereum && window.ethereum.isMetaMask) {
        // enforce to switch to goerili network
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x5' }],
        });
        
        // connect to account and fetch user token information from blockchain
        const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
        const contractAbi = require('./ContractAbi.json');
        const web3 = new Web3(process.env.REACT_APP_GOERLI_ALCHEMY_PROVIDER);
        const tokenContract = new web3.eth.Contract(contractAbi, contractAddress);
        const userInfo = {
          WalletAddress: '',
          TokenSymbol: '',
          TokenName: '',
          UserBalance: ''
        };
        
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userInfo.WalletAddress = accounts[0]
        userInfo.TokenName = await tokenContract.methods.name().call();
        userInfo.TokenSymbol = await tokenContract.methods.symbol().call();
        const userBalanceInWei = await tokenContract.methods.balanceOf(userInfo.WalletAddress).call();
        userInfo.UserBalance = web3.utils.fromWei(userBalanceInWei, 'ether');

        console.log("Login Successful and retrieved data from blockchain.");
        console.log(userInfo.WalletAddress + " " + userInfo.UserBalance + " , " + userInfo.TokenSymbol);

        setUserInfo(userInfo);
        setIsMetaMaskConnected(true);
        upsertUserInfo(userInfo);
      }
      else{
        window.alert("Metamask not configured.");
      }
    } 
    catch (error) {
      console.error(error);
    }
  };

  // this method sets the wallet address where the minted token should be transferred.
  const handleMintToAddress = (element) => {
    setMintToAddress(element.target.value);
  }

  // this method is invoked to mint new tokens.
  const mintToken = async () => {
      try {
        setIsMintSuccessful(false);
        console.log("Minting tokens.");
        const metaMaskProvider = new Web3(window.ethereum);
        const mintAmount =  metaMaskProvider.utils.toWei(process.env.REACT_APP_MINT_AMOUNT, 'ether');
        const contractAbi = require('./ContractAbi.json');
        const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
        const myContract = new metaMaskProvider.eth.Contract(contractAbi, contractAddress);
        const newDate = new Date().toISOString();
        const mintEvent = {
          FromAddress: userInfo.WalletAddress, 
          ToAddress: mintToAddress, 
          MintAmount: process.env.REACT_APP_MINT_AMOUNT, 
          TokenSymbol: userInfo.TokenSymbol, 
          SuccessStatus: true, 
          StartTime: newDate, 
          EndTime: newDate
        };

        await myContract.events.Transfer({ from: userInfo.WalletAddress, to: mintToAddress })
        .once('data', event => {
          console.log('Transfer event:', event);
          upsertMintEvent(mintEvent);
          setIsMintSuccessful(true);
        })
        .on('error', error => {
          console.error('Error in Transfer event subscription:', error);
        });

        const result = await myContract.methods.mint(mintToAddress, mintAmount).send({ from: userInfo.WalletAddress});
        console.log(result);
      }
      catch (error)
      {
        console.error(error);
      }
    }

  return (
    <div style={{ padding: '10px', margin: '10px'}}>
      {isMintSuccessful && <p style={{backgroundColor: 'green', color: 'black'}}> Tokens minted to address: {mintToAddress} </p>}
      {!isMetaMaskConnected && (<button onClick={connectToMetamask}>Connect Metamask</button>)}
      {isMetaMaskConnected && <p><b>Connected Address:</b> {userInfo.WalletAddress}</p>}
      
      
      <p>Token Name:  {userInfo.TokenName}</p>
      <p>Token Symbol:  {userInfo.TokenSymbol}</p>
      <p>User Balance:  {userInfo.UserBalance}</p>

      <div style={{ display: 'flex', textAlign: 'center' }}>
        <input type="text" placeholder="Insert user address here" value={mintToAddress} onChange={handleMintToAddress} style={{ marginRight: 10, width: '64ch'}} />
        <button onClick={mintToken}>Mint Tokens</button>
      </div>

      <div style={{ marginTop: '10px'}}>
        <button onClick={getUserHistory}>Show User History</button>
        {showUserHistory && <p> <b>Account details:</b>{showUserHistory.AccountInfo}</p>}
        {showUserHistory && <p> <b>Login details:</b> {showUserHistory.LoginInfo}</p>}
        {showUserHistory && <p> <b>Mint details:</b> {showUserHistory.MintInfo}</p>}
      </div>

    </div>
  );
}

export default App;