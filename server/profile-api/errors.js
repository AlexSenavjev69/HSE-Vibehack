export class ProfileError extends Error {
  constructor(message, status = 400, fields = {}) {
    super(message)
    this.name = 'ProfileError'
    this.status = status
    this.fields = fields
  }
}
