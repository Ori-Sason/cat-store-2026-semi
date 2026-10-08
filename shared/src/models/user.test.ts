import { describe, expect, it } from 'vitest'
import { loginSchema, signupSchema, userSchema, type LoginInput, type UserInput } from './user.ts'

const validUser: UserInput = {
  fullname: 'Regular User',
  username: 'user',
  password: 'Secret-pass1',
}

const _issueMessages = (input: unknown) => {
  const result = userSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

describe('userSchema', () => {
  it('accepts a valid user as is', () => {
    expect(userSchema.parse(validUser)).toEqual(validUser)
  })

  it('strips isAdmin and server-set fields', () => {
    const parsed = userSchema.parse({
      ...validUser,
      isAdmin: true,
      _id: 'abc',
      createdAt: 1,
      updatedAt: 2,
    })
    expect(parsed).toEqual(validUser)
  })

  describe('fullname', () => {
    it('trims whitespace', () => {
      expect(userSchema.parse({ ...validUser, fullname: '  Regular User  ' }).fullname).toBe(
        'Regular User',
      )
    })

    it.each([
      ['missing', undefined],
      ['only spaces', '   '],
      ['too short', 'R'],
      ['too long', 'R'.repeat(51)],
    ])('rejects a fullname that is %s', (_, fullname) => {
      expect(_issueMessages({ ...validUser, fullname })).toEqual([
        expect.stringMatching(/^fullname: /),
      ])
    })
  })

  describe('username', () => {
    it('trims and lowercases', () => {
      expect(userSchema.parse({ ...validUser, username: '  Admin_1 ' }).username).toBe('admin_1')
    })

    it.each([
      ['missing', undefined],
      ['too short', 'ab'],
      ['too long', 'a'.repeat(21)],
      ['with a space', 'ad min'],
      ['with a symbol', 'admin!'],
    ])('rejects a username that is %s', (_, username) => {
      const messages = _issueMessages({ ...validUser, username })
      expect(messages.length).toBeGreaterThan(0)
      expect(messages.every((message) => message.startsWith('username: '))).toBe(true)
    })
  })

  describe('password', () => {
    // 'א' is 2 bytes in UTF-8: 4 + 34 * 2 = 72 bytes, exactly bcrypt's limit
    it.each([
      'Abcdef1!',
      'A1!' + 'a'.repeat(47),
      'Ab1!' + 'א'.repeat(34),
      'Ab1!' + '😺'.repeat(17),
    ])('accepts %s', (password) => {
      expect(userSchema.parse({ ...validUser, password }).password).toBe(password)
    })

    it.each([
      ['too short', 'Ab1!', 'Password must be at least 8 characters'],
      ['too long', 'Ab1!' + 'a'.repeat(47), 'Password must be at most 50 characters'],
      ['missing a lowercase letter', 'SECRET-PASS1', 'Password must have a lowercase letter'],
      ['missing an uppercase letter', 'secret-pass1', 'Password must have an uppercase letter'],
      ['missing a digit', 'Secret-pass', 'Password must have a digit'],
      ['missing a symbol', 'SecretPass1', 'Password must have a symbol'],
      [
        'over 72 bytes, though under 50 characters',
        'Ab1!' + 'א'.repeat(35),
        'Password is too long',
      ],
      // '😺' is 4 bytes: 4 + 17 * 4 = 72 is fine, 18 of them is over
      ['over 72 bytes with 4-byte characters', 'Ab1!' + '😺'.repeat(18), 'Password is too long'],
    ])('rejects a password that is %s', (_, password, message) => {
      expect(_issueMessages({ ...validUser, password })).toEqual([`password: ${message}`])
    })
  })
})

describe('signupSchema', () => {
  it('defaults isRemembered to false', () => {
    expect(signupSchema.parse(validUser)).toEqual({ ...validUser, isRemembered: false })
  })

  it('keeps isRemembered when sent', () => {
    expect(signupSchema.parse({ ...validUser, isRemembered: true }).isRemembered).toBe(true)
  })

  it('still enforces the password rules', () => {
    expect(signupSchema.safeParse({ ...validUser, password: 'weak' }).success).toBe(false)
  })

  it('rejects a non-boolean isRemembered', () => {
    expect(signupSchema.safeParse({ ...validUser, isRemembered: 'yes' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  const validLogin: LoginInput = { username: 'user', password: 'Secret-pass1', isRemembered: false }

  it('trims and lowercases the username, and defaults isRemembered to false', () => {
    expect(loginSchema.parse({ username: '  Admin ', password: 'x' })).toEqual({
      username: 'admin',
      password: 'x',
      isRemembered: false,
    })
  })

  it('accepts a password that breaks the signup rules', () => {
    expect(loginSchema.parse({ ...validLogin, password: 'weak' }).password).toBe('weak')
  })

  it('strips unknown keys', () => {
    expect(loginSchema.parse({ ...validLogin, fullname: 'Regular User', isAdmin: true })).toEqual(
      validLogin,
    )
  })

  it.each([
    ['username', { ...validLogin, username: '   ' }],
    ['username', { password: 'x' }],
    ['password', { ...validLogin, password: '' }],
    ['password', { username: 'user' }],
  ])('rejects a missing or empty %s', (field, input) => {
    const result = loginSchema.safeParse(input)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([field])
  })
})
