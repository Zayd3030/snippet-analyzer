import { useEffect, useRef, useState } from 'react'
import { createSnippet, updateSnippet } from '../api/snippets.js'
import AnalysisBadges, { KeywordTags } from './AnalysisBadges.jsx'

// copied from the server's validateSnippet.js so users get instant feedback.
// the server still checks everything, these just save a round trip
const LIMITS = { title: 120, content: 10_000 }

function validate(title, content) {
  const errors = {}
  const titleLength = title.trim().length
  const contentLength = content.trim().length

  if (titleLength === 0) errors.title = "Title can't be empty"
  else if (titleLength > LIMITS.title) errors.title = 'Title must be 120 characters or fewer'

  if (contentLength === 0) errors.content = "Content can't be empty"
  else if (contentLength > LIMITS.content) errors.content = 'Content must be 10,000 characters or fewer'

  return errors
}

const BUTTON =
  'rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50'
const PRIMARY = `${BUTTON} bg-slate-900 text-white hover:bg-slate-700`
const SECONDARY = `${BUTTON} border border-slate-300 bg-white hover:bg-slate-50`
const FIELD =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:border-slate-900 focus-visible:outline-2 focus-visible:outline-slate-900 aria-invalid:border-red-500'

function Counter({ id, length, max }) {
  return (
    <span id={id} className={`text-xs ${length > max ? 'font-medium text-red-600' : 'text-slate-500'}`}>
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  )
}

function SnippetModal({ initialSnippet, onSaved, onClose }) {
  const dialogRef = useRef(null)
  const titleRef = useRef(null)
  const doneRef = useRef(null)
  const pointerDownOnBackdrop = useRef(false)

  // null until the first save in create mode, then the latest saved version
  const [snippet, setSnippet] = useState(initialSnippet)
  const [view, setView] = useState('form')
  const [title, setTitle] = useState(initialSnippet?.title ?? '')
  const [content, setContent] = useState(initialSnippet?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState(null)
  // field errors only show after the first save attempt, not while someone is still typing
  const [submitted, setSubmitted] = useState(false)

  const isEdit = snippet !== null
  const errors = validate(title, content)
  const hasErrors = Object.keys(errors).length > 0
  // title is compared trimmed because the server trims it, content is stored exactly as typed
  const isDirty = isEdit
    ? title.trim() !== snippet.title || content !== snippet.content
    : title !== '' || content !== ''

  useEffect(() => {
    // no close() in a cleanup: StrictMode's fake unmount would queue a close event and shut
    // the modal straight away in dev. Removing the element on a real unmount closes it anyway
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    if (view === 'result') doneRef.current.focus()
    else titleRef.current.focus()
  }, [view])

  function requestClose() {
    if (saving) return
    if (view === 'form' && isDirty && !window.confirm('Discard unsaved changes?')) return
    dialogRef.current.close()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    // ctrl+enter submits even while the Save button is disabled, so check the same conditions
    if (saving || (isEdit && !isDirty)) return
    setSubmitted(true)
    if (hasErrors) return

    setSaving(true)
    setServerError(null)
    try {
      const saved = isEdit
        ? await updateSnippet(snippet.id, { title, content })
        : await createSnippet({ title, content })
      onSaved(saved)
      setSnippet(saved)
      setView('result')
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      // requestSubmit runs the same validation path as clicking Save
      event.currentTarget.requestSubmit()
    }
  }

  function handleEditAgain() {
    setTitle(snippet.title)
    setContent(snippet.content)
    setSubmitted(false)
    setView('form')
  }

  // a click counts as the backdrop only if it started there too, so dragging a text
  // selection out of the textarea doesn't close the modal
  function handlePointerDown(event) {
    pointerDownOnBackdrop.current = event.target === dialogRef.current
  }

  function handleClick(event) {
    if (event.target === dialogRef.current && pointerDownOnBackdrop.current) requestClose()
  }

  const showTitleError = submitted && errors.title
  const showContentError = submitted && errors.content

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="snippet-modal-heading"
      onClose={onClose}
      onCancel={(event) => {
        // escape goes through the same unsaved-changes check as cancel
        event.preventDefault()
        requestClose()
      }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
    >
      {view === 'form' ? (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="space-y-4 p-6">
          <h2 id="snippet-modal-heading" className="text-lg font-semibold">
            {isEdit ? 'Edit snippet' : 'New snippet'}
          </h2>

          {serverError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {serverError}
            </p>
          )}

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="snippet-title" className="text-sm font-medium">
                Title
              </label>
              <Counter id="snippet-title-count" length={title.trim().length} max={LIMITS.title} />
            </div>
            <input
              ref={titleRef}
              id="snippet-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={showTitleError ? true : undefined}
              aria-describedby={`snippet-title-count${showTitleError ? ' snippet-title-error' : ''}`}
              className={FIELD}
            />
            {showTitleError && (
              <p id="snippet-title-error" className="mt-1 text-sm text-red-600">
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="snippet-content" className="text-sm font-medium">
                Content
              </label>
              <Counter id="snippet-content-count" length={content.trim().length} max={LIMITS.content} />
            </div>
            <textarea
              id="snippet-content"
              rows={12}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              aria-invalid={showContentError ? true : undefined}
              aria-describedby={`snippet-content-count${showContentError ? ' snippet-content-error' : ''}`}
              className={`${FIELD} resize-y font-mono`}
            />
            {showContentError && (
              <p id="snippet-content-error" className="mt-1 text-sm text-red-600">
                {errors.content}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-xs text-slate-500 sm:mr-auto">Ctrl/Cmd + Enter to save</span>
            <button type="button" onClick={requestClose} disabled={saving} className={SECONDARY}>
              Cancel
            </button>
            <button type="submit" disabled={saving || (isEdit && !isDirty)} className={PRIMARY}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5 p-6" aria-live="polite">
          <h2 id="snippet-modal-heading" className="text-lg font-semibold">
            {snippet.category ? 'Saved and analysed' : 'Saved'}
          </h2>

          {snippet.category ? (
            <div className="space-y-3 rounded-lg bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="text-sm text-slate-600">
                Tagged as <span className="block text-2xl font-semibold text-slate-900">{snippet.category}</span>
              </p>
              <AnalysisBadges
                category={snippet.category}
                sentimentLabel={snippet.sentimentLabel}
                sentimentScore={snippet.sentimentScore}
              />
              <KeywordTags keywords={snippet.keywords} />
              {snippet.wordCount != null && (
                <p className="text-xs text-slate-500">
                  {snippet.wordCount.toLocaleString()} {snippet.wordCount === 1 ? 'word' : 'words'}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600 ring-1 ring-slate-200">
              Your snippet was saved, but the analysis didn't run. Use Re-analyse on the card to try again.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={handleEditAgain} className={SECONDARY}>
              Edit
            </button>
            <button ref={doneRef} type="button" onClick={requestClose} className={PRIMARY}>
              Done
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}

export default SnippetModal
