const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Maximum length for a Vault token. Vault service/wrapping tokens are well
// under this; the cap blocks oversized payloads being shoved into a header.
const MAX_TOKEN_LENGTH = 512;
const MIN_TOKEN_LENGTH = 3;

// Vault tokens only ever contain these characters. Restricting to this set
// also prevents CR/LF header injection.
const TOKEN_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Resolve the Vault address. Prefers the VAULT_ADDRESS environment variable
 * (used on Vercel); falls back to config.json for local development.
 */
function getVaultAddress() {
  if (process.env.VAULT_ADDRESS) {
    return process.env.VAULT_ADDRESS.trim();
  }
  try {
    const config = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf8')
    );
    return config.vault_address;
  } catch (e) {
    return null;
  }
}

/**
 * Validate the resolved Vault address. HTTPS is required, except for
 * localhost which is allowed over HTTP for local development.
 * Returns { ok: true } or { ok: false, error }.
 */
function validateVaultAddress(address) {
  if (!address) {
    return { ok: false, error: 'Vault address is not configured' };
  }
  let url;
  try {
    url = new URL(address);
  } catch (e) {
    return { ok: false, error: 'Vault address is not a valid URL' };
  }
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
    return { ok: false, error: 'Vault address must use HTTPS' };
  }
  return { ok: true };
}

/**
 * Validate a user-supplied token. Returns { ok: true } or { ok: false, error }.
 */
function validateToken(token) {
  if (typeof token !== 'string') {
    return { ok: false, error: 'Token must be a string' };
  }
  if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, error: 'Token has an invalid length' };
  }
  if (!TOKEN_PATTERN.test(token)) {
    return { ok: false, error: 'Token contains invalid characters' };
  }
  return { ok: true };
}

/**
 * Turn an error into a message that is safe to return to the client.
 * Vault's own token errors are safe and useful; network/timeout errors are
 * kept generic so they cannot leak the internal Vault address or topology.
 */
function sanitizeError(error) {
  if (error.response) {
    const vaultErrors = error.response.data && error.response.data.errors;
    if (Array.isArray(vaultErrors) && vaultErrors.length > 0) {
      return vaultErrors.join('; ');
    }
    return `Vault returned status ${error.response.status}`;
  }
  return 'Unable to reach the Vault server';
}

/**
 * Perform the unwrap call against Vault. Assumes the token has already been
 * validated. Returns { success, data } or { success, error }.
 */
async function unwrap(token) {
  const vaultAddress = getVaultAddress();
  const addressCheck = validateVaultAddress(vaultAddress);
  if (!addressCheck.ok) {
    return { success: false, error: addressCheck.error };
  }

  try {
    const response = await axios.post(
      `${vaultAddress.replace(/\/+$/, '')}/v1/sys/wrapping/unwrap`,
      {},
      {
        headers: { 'X-Vault-Token': token },
        timeout: 8000,
        maxRedirects: 0, // never follow redirects away from the configured Vault
        maxContentLength: 1024 * 1024, // 1 MB response cap
        maxBodyLength: 1024 * 1024,
      }
    );

    if (response.data && response.data.data) {
      return { success: true, data: JSON.stringify(response.data.data, null, 2) };
    }
    return { success: false, error: 'Invalid response format' };
  } catch (error) {
    return { success: false, error: sanitizeError(error) };
  }
}

module.exports = {
  MAX_TOKEN_LENGTH,
  validateToken,
  validateVaultAddress,
  getVaultAddress,
  sanitizeError,
  unwrap,
};
