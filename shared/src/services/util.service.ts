// Not ObjectId.isValid: it also accepts any 12-character string, e.g. "twelve chars"
function getObjectIdRegex(): RegExp {
  return /^[0-9a-f]{24}$/i
}

// `shared` prefix: the frontend and the backend each have their own utilService
export const sharedUtilService = {
  getObjectIdRegex,
}
