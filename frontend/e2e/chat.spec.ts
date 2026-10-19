import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { signUpViaApi } from './helpers/auth.helper.ts'
import { createCatViaApi } from './helpers/cat.helper.ts'

// The live chat on cat-details, across three browser contexts: two users and a guest, each with
// its own cookies and its own socket. The E2E seed fills every seed cat's chat at random, so the
// test uses a cat it adds itself, with an empty log. Seed cats aren't touched.

const AUTHOR_NAME = 'Chat Author'
const READER_NAME = 'Chat Reader'

// Scoped to the panel: the cat's own Edit / Delete sit on the same page for its owner
function _getPanel(page: Page) {
  return page.getByRole('region', { name: 'Chat' })
}

function _getMsg(page: Page, text: string) {
  return _getPanel(page).getByRole('article').filter({ hasText: text })
}

// Waits for the empty log: it shows only once the join ack and the first fetch are in, so a msg
// sent after this can't slip in before the reader's room join
async function _openEmptyChat(page: Page, catUrl: string) {
  await page.goto(catUrl)
  await page.getByRole('button', { name: 'Open chat' }).click()
  await expect(_getPanel(page).getByText('No messages yet')).toBeVisible()
}

// A context's request shares its cookies, so signing up there logs the whole context in
async function _newUserContext(browser: Browser, prefix: string, fullname: string) {
  const context = await browser.newContext()
  await signUpViaApi(context.request, prefix, fullname)
  return context
}

async function _createCat(request: APIRequestContext) {
  const cat = await createCatViaApi(request, { name: `Chat cat ${Date.now()}` })
  return `/cat/${cat._id}`
}

// Contexts from browser.newContext() aren't fixtures, so Playwright doesn't close them itself
const contexts: BrowserContext[] = []

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

test('two users see each other live: typing, send, edit and delete, and a guest reads', async ({
  browser,
}) => {
  const authorContext = await _newUserContext(browser, 'ca', AUTHOR_NAME)
  const readerContext = await _newUserContext(browser, 'cr', READER_NAME)
  const guestContext = await browser.newContext()
  contexts.push(authorContext, readerContext, guestContext)
  const catUrl = await _createCat(authorContext.request)
  const authorPage = await authorContext.newPage()
  const readerPage = await readerContext.newPage()
  const guestPage = await guestContext.newPage()

  await _openEmptyChat(authorPage, catUrl)
  await _openEmptyChat(readerPage, catUrl)

  // Typing: the reader sees the line, the author doesn't see their own
  const text = `Is she ok with dogs? ${Date.now()}`
  const composer = _getPanel(authorPage).getByRole('textbox', { name: 'Message' })
  await composer.fill(text)
  await expect(_getPanel(readerPage).getByText(`${AUTHOR_NAME} is typing…`)).toBeVisible()
  await expect(_getPanel(authorPage).getByText(/is typing…/)).toHaveCount(0)

  // Send: saved on the author's side, live on the reader's, and the send clears the typing line
  await composer.press('Enter')
  await expect(_getMsg(authorPage, text)).toBeVisible()
  await expect(_getMsg(authorPage, text).getByText('Sending…')).toHaveCount(0)
  const readerMsg = _getMsg(readerPage, text)
  await expect(readerMsg).toBeVisible()
  await expect(readerMsg).toContainText(AUTHOR_NAME)
  // The author owns the cat, so their row carries the Owner chip
  await expect(readerMsg.getByText('Owner', { exact: true })).toBeVisible()
  await expect(_getPanel(readerPage).getByText(/is typing…/)).toHaveCount(0)
  // Someone else's msg: no actions for a non-admin reader
  await expect(readerMsg.getByRole('button', { name: 'Message actions' })).toHaveCount(0)

  // Edit: the author saves a new text, and the reader gets it with "Edited at"
  const editedText = `${text} edited`
  const authorMsg = _getMsg(authorPage, text)
  await authorMsg.getByRole('button', { name: 'Message actions' }).click()
  await authorMsg.getByRole('button', { name: 'Edit' }).click()
  const editField = authorMsg.getByRole('textbox', { name: 'Edit message' })
  await editField.fill(editedText)
  await editField.press('Enter')
  await expect(_getMsg(authorPage, editedText).getByText(/^Edited at /)).toBeVisible()
  await expect(_getMsg(readerPage, editedText).getByText(/^Edited at /)).toBeVisible()

  // Delete: after the confirm, both sides show the tombstone in the msg's place
  await _getMsg(authorPage, editedText).getByRole('button', { name: 'Message actions' }).click()
  await _getMsg(authorPage, editedText).getByRole('button', { name: 'Delete' }).click()
  const confirm = _getPanel(authorPage).getByRole('alertdialog', { name: 'Delete this message?' })
  await confirm.getByRole('button', { name: 'Delete' }).click()
  for (const page of [authorPage, readerPage]) {
    await expect(_getPanel(page).getByText('Message deleted')).toBeVisible()
    await expect(_getPanel(page).getByText(editedText)).toHaveCount(0)
  }
  // The tombstone keeps the header (name and time)
  await expect(_getPanel(readerPage).getByRole('article')).toHaveCount(1)
  await expect(_getPanel(readerPage).getByRole('article')).toContainText(AUTHOR_NAME)

  // A guest reads the log from history, with the login CTA in the composer's place
  await guestPage.goto(catUrl)
  await guestPage.getByRole('button', { name: 'Open chat' }).click()
  await expect(_getPanel(guestPage).getByText('Message deleted')).toBeVisible()
  await expect(_getPanel(guestPage).getByRole('textbox', { name: 'Message' })).toHaveCount(0)
  await expect(_getPanel(guestPage).getByRole('button', { name: 'Message actions' })).toHaveCount(0)
  await expect(_getPanel(guestPage).getByRole('link', { name: 'Log in to chat' })).toBeVisible()
})
