const HOST_PREFIX = 'www.';

function stripWwwPrefix(hostname) {
  if (typeof hostname !== 'string') return null;
  return hostname.startsWith(HOST_PREFIX) ? hostname.slice(HOST_PREFIX.length) : null;
}

function getHostnameFallbackUrl(url) {
  try {
    const parsed = new URL(url);
    const fallbackHostname = stripWwwPrefix(parsed.hostname);
    if (!fallbackHostname) {
      return null;
    }
    parsed.hostname = fallbackHostname;
    return parsed.toString();
  } catch (error) {
    return null;
  }
}

function isDnsResolutionError(error) {
  if (!error) {
    return false;
  }

  const code = error.code || error.errno;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return true;
  }

  const message = String(error.message || '').toLowerCase();
  return message.includes('enotfound') ||
         message.includes('eai_again') ||
         message.includes('err_name_not_resolved');
}

module.exports = {
  getHostnameFallbackUrl,
  isDnsResolutionError
};
