const anchor = require('@coral-xyz/anchor');

module.exports = async function deploy(_provider) {
  anchor.setProvider(_provider);
};
