// @flow
import { connect } from 'react-redux'

import { sendEther } from '../../actions/contractForm'
import SendEther from '../../components/contract-form/SendEther'

function mapStateToProps(state) {
  const { selectedFile, accounts } = state
  return {
    file: selectedFile,
    accounts,
  }
}

const mapDispatchToProps = dispatch => ({
  sendEther: (ether) => dispatch(sendEther(ether)),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(SendEther)
