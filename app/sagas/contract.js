import { takeEvery, call, put } from 'redux-saga/effects'
import { message } from 'antd'

import {
  CONTRACT_DEPLOY,
  CONTRACT_CALL_FUNCTION,
  CONTRACT_SELECT_ADDRESS,
  CONTRACT_BALANCES_LOAD,
  CONTRACT_BALANCES_SET,
  CONTRACT_SEND_ETHER,
  FUNCTION_CALL_RESULTS_UPDATE,
  SELECTED_FILE_SET,
  FILES_FETCH_ALL,
} from '../constants/actions'

import { Files } from '../datastore'

import {
  promiseDbUpdate,
  getWeb3,
  deployContract,
  executeContractFunction,
  sendEtherToContract,
} from '../utils'

export function* deploy(action) {
  try {
    const { file, inputs, account } = action.payload
    const transactionReceipt = yield call(deployContract, file, inputs, account)
    const { contractAddress } = transactionReceipt
    // TODO: hmm, it seems we can't do $push & $set in one go...
    const query_change_1 = {
      $push: { 'deployedAt.addresses': { address: contractAddress } },
    }
    const query_change_2 = {
      $set: { 'deployedAt.selected.address': { address: contractAddress } },
    }

    yield call(promiseDbUpdate, Files, { _id: file._id }, query_change_1)
    yield call(promiseDbUpdate, Files, { _id: file._id }, query_change_2)

    file.deployedAt.addresses.push({ address: contractAddress, balance: 0 })
    file.deployedAt.selected.address = { address: contractAddress, balance: 0 }

    message.success(`deployed contract at ${contractAddress}`)
    yield put({ type: SELECTED_FILE_SET, file })
    yield put({ type: FILES_FETCH_ALL })
  } catch (e) {
    if (e.message === 'Invalid JSON RPC response: ""') {
      message.error(e.message)
      message.error('Are you sure your connections are healthy?')
    } else {
      console.log(e)
      message.error(e.message)
    }
  }
}

export function* callFunction(action) {
  try {
    const { file, functionDetails, inputs, transactionValue, account} = action.payload
    const deployedAt = file.deployedAt.selected.address
    const result = yield call(
      executeContractFunction,
      file,
      deployedAt.address,
      functionDetails,
      inputs,
      transactionValue,
      account,
    )
    const payload = {
      result,
      functionDetails,
    }
    message.success('call executed')
    yield put({ type: FUNCTION_CALL_RESULTS_UPDATE, payload })
  } catch (e) {
    console.log(e)
    message.error(e.message)
  }
}

export function* setSelectedAddress(action) {
  const { file, address } = action.payload
  try {
    let query_find = { _id: file._id }
    let query_change = {
      $set: { 'deployedAt.selected': { address } }
    }
    yield call(promiseDbUpdate, Files, query_find, query_change)
    file.deployedAt.selected = { address }
    yield put({ type: SELECTED_FILE_SET, file })
    yield put({ type: FILES_FETCH_ALL })
  } catch (e) {
    console.log(e)
    message.error(e.message)
  }
}

export function* loadContractBalances(action) {
  const file = {
    ...action.file
  }
  try {
    const web3 = yield call(getWeb3)
    function getAddressBalancePromise(address) {
      return new Promise(function(resolve, reject) {
        resolve(web3.eth.getBalance(address))
      })
    }
    for (let i=0; i<file.deployedAt.addresses.length; i++) {
      if (file.deployedAt.addresses[i]) {
        const balance = yield call(getAddressBalancePromise, file.deployedAt.addresses[i].address)
        file.deployedAt.addresses[i].balance = balance
      }
    }
    yield put({ type: CONTRACT_BALANCES_SET, file })
  } catch (e) {
    console.log(e)
    message.error(e.message)
  }
}

export function* sendEther(action) {
  try {
    const { file, ether, account } = action.payload
    const deployedAt = file.deployedAt.selected.address.address
    const result = yield call(sendEtherToContract, file, deployedAt, ether, account)
    message.success('ether sent')
  } catch (e) {
    console.log(e)
    message.error(e.message)
  }
}

export function* contractSaga() {
  yield takeEvery(CONTRACT_DEPLOY, deploy)
  yield takeEvery(CONTRACT_CALL_FUNCTION, callFunction)
  yield takeEvery(CONTRACT_SELECT_ADDRESS, setSelectedAddress)
  yield takeEvery(CONTRACT_BALANCES_LOAD, loadContractBalances)
  yield takeEvery(CONTRACT_SEND_ETHER, sendEther)
}
