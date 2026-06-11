import { useState, useEffect, useRef } from 'react'

interface Prompt {
  prompt: string
  echo: boolean
}

interface Props {
  promptId: string
  name: string
  instructions: string
  prompts: Prompt[]
  onRespond: (promptId: string, answers: string[]) => void
  onCancel: (promptId: string) => void
}

export default function SshPromptModal({ promptId, name, instructions, prompts, onRespond, onCancel }: Props) {
  const [answers, setAnswers] = useState<string[]>(prompts.map(() => ''))
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(promptId) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [promptId, onCancel])

  const submit = () => onRespond(promptId, answers)

  const setAnswer = (i: number, value: string) => {
    setAnswers(prev => { const next = [...prev]; next[i] = value; return next })
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>Authentication Required</h2>
        </div>
        <div className="modal-body">
          {name && <p className="ssh-prompt-server">{name}</p>}
          {instructions && <p className="ssh-prompt-instructions">{instructions}</p>}
          {prompts.map((p, i) => (
            <div key={i} className="form-row">
              <label>{p.prompt.replace(/:?\s*$/, '') || 'Input'}</label>
              <input
                ref={i === 0 ? firstRef : undefined}
                type={p.echo ? 'text' : 'password'}
                value={answers[i]}
                autoComplete="off"
                onChange={e => setAnswer(i, e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (i === prompts.length - 1) submit()
                    else (e.currentTarget.closest('.modal-body')?.querySelectorAll('input')[i + 1] as HTMLInputElement | null)?.focus()
                  }
                }}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button onClick={() => onCancel(promptId)}>Cancel</button>
          <button className="btn-primary" onClick={submit}>Submit</button>
        </div>
      </div>
    </div>
  )
}
