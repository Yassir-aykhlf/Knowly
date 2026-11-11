import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api, ApiError } from '../lib/api'
import type { User } from '../lib/types'
import { USERNAME_RE, validatePassword } from '../lib/validation'

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [profileSaving, setProfileSaving] = useState(false)

  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteFieldError, setDeleteFieldError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    setUsername(user.username)
    setBio(user.bio ?? '')
  }, [user?.id, user?.username, user?.bio])

  if (!user) {
    return <p className="ah-page text-body text-ink-muted" role="status">Loading your account…</p>
  }

  const canDelete = user.has_password
    ? deleteConfirmation.length > 0
    : deleteConfirmation === 'DELETE'

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors: Record<string, string> = {}

    if (!USERNAME_RE.test(username)) {
      errors.username = 'Use 3–30 letters, numbers, _ or -.'
    }

    if (bio.length > 500) {
      errors.bio = 'Bio must be 500 characters or fewer.'
    }

    if (Object.keys(errors).length) {
      setProfileErrors(errors)
      return
    }

    setProfileErrors({})
    setProfileSaving(true)

    try {
      await api.put<User>('/users/me', { username, bio })
      await refresh()
      showToast('Profile updated successfully.')
    } catch (err) {
      if (err instanceof ApiError) {
        setProfileErrors(err.fields ?? {})
        if (!err.fields || Object.keys(err.fields).length === 0) {
          showToast(err.message, 'error')
        }
      } else {
        showToast('Could not update your profile.', 'error')
      }
    } finally {
      setProfileSaving(false)
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file || avatarSaving) return
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp'])
    if (!allowed.has(file.type) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      setAvatarError('Choose a non-empty PNG, JPEG or WebP image no larger than 2 MiB.')
      input.value = ''
      return
    }

    setAvatarSaving(true)
    setAvatarError(null)

    try {
      const form = new FormData()
      form.append('file', file)

      await api.postForm<User>('/users/me/avatar', form)
      await refresh()
      showToast('Avatar updated.')
    } catch (err) {
      const message = err instanceof ApiError
        ? err.fields?.avatar ?? err.message
        : 'Could not upload avatar.'
      setAvatarError(message)
    } finally {
      setAvatarSaving(false)
      input.value = ''
    }
  }

  async function removeAvatar() {
    setAvatarSaving(true)
    setAvatarError(null)

    try {
      await api.del<User>('/users/me/avatar')
      await refresh()
      showToast('Avatar removed.')
    } catch (err) {
      setAvatarError(
        err instanceof ApiError ? err.message : 'Could not remove avatar.',
      )
    } finally {
      setAvatarSaving(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validatePassword(newPassword)

    if (validation) {
      setPasswordErrors({ new_password: validation })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordErrors({ confirm_password: 'Passwords do not match.' })
      return
    }

    setPasswordErrors({})
    setPasswordSaving(true)

    try {
      await api.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showToast('Password changed successfully.')
    } catch (err) {
      if (err instanceof ApiError) {
        setPasswordErrors(err.fields ?? {})
        if (!err.fields || Object.keys(err.fields).length === 0) {
          showToast(err.message, 'error')
        }
      } else {
        showToast('Could not change password.', 'error')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  function closeDeleteModal() {
    if (deleting) return
    setDeleteOpen(false)
    setDeleteConfirmation('')
    setDeleteError(null)
    setDeleteFieldError(null)
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canDelete || deleting) return

    setDeleting(true)
    setDeleteError(null)
    setDeleteFieldError(null)

    try {
      await api.del('/users/me',
        user!.has_password
          ? { password: deleteConfirmation }
          : { confirm: deleteConfirmation },
      )

      setDeleteOpen(false)
      await refresh()
      showToast('Your account has been deleted.')
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const field = user!.has_password ? 'password' : 'confirm'
        setDeleteFieldError(err.fields?.[field] ?? null)
        if (!err.fields?.[field]) setDeleteError(err.message)
      } else {
        setDeleteError('Could not delete account. Please try again.')
      }
    } finally {
      setDeleting(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="ah-page max-w-[840px] space-y-5">
      <h1 className="ah-h1">Settings</h1>

      <section className="ah-card p-4 lg:p-6" aria-labelledby="settings-profile">
        <h2 id="settings-profile" className="ah-h3 mb-4">Profile</h2>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label htmlFor="settings-username" className="ah-label">
              Username
            </label>
            <input
              id="settings-username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                setProfileErrors((old) => ({ ...old, username: '' }))
              }}
              aria-invalid={Boolean(profileErrors.username) || (username.length > 0 && !USERNAME_RE.test(username))}
              aria-describedby="settings-username-help"
              autoComplete="username"
              className="ah-input"
              required
            />
            <p
              id="settings-username-help"
              className={`ah-help ${!USERNAME_RE.test(username) && username.length > 0 ? 'text-warn' : ''}`}
            >
              Use 3–30 letters, numbers, _ or -.
            </p>
            {profileErrors.username && (
              <p className="ah-error" role="alert">
                {profileErrors.username}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="settings-bio" className="ah-label">
              Bio
            </label>
            <textarea
              id="settings-bio"
              value={bio}
              onChange={(event) => {
                setBio(event.target.value)
                setProfileErrors((old) => ({ ...old, bio: '' }))
              }}
              rows={4}
              aria-invalid={bio.length > 500 || Boolean(profileErrors.bio)}
              className="ah-textarea"
            />
            <p className={`ah-help tabular-nums ${bio.length > 500 ? 'text-danger' : ''}`}>{bio.length}/500 characters</p>
            {bio.length > 500 && (
              <p className="ah-error">
                Bio must be 500 characters or fewer.
              </p>
            )}
            {profileErrors.bio && (
              <p className="ah-error" role="alert">{profileErrors.bio}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={profileSaving || !USERNAME_RE.test(username) || bio.length > 500}
            className="ah-btn-primary"
          >
            {profileSaving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="ah-card p-4 lg:p-6" aria-labelledby="settings-avatar">
        <h2 id="settings-avatar" className="ah-h3 mb-4">Avatar</h2>

        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={user} size={64} />
          <div className="flex flex-wrap items-center gap-2">
            <label className={`ah-btn-secondary focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${avatarSaving ? 'cursor-not-allowed opacity-50' : ''}`}>
              {avatarSaving ? 'Working…' : 'Upload image'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadAvatar}
                disabled={avatarSaving}
                className="sr-only"
              />
            </label>

            {user.avatar_url && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarSaving}
                className="ah-btn-ghost"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <p className="ah-help mt-3">PNG, JPEG or WebP, up to 2 MiB.</p>

        {avatarError && (
          <p role="alert" className="ah-error">
            {avatarError}
          </p>
        )}
      </section>

      {user.has_password && (
        <section className="ah-card p-4 lg:p-6" aria-labelledby="settings-password">
          <h2 id="settings-password" className="ah-h3 mb-4">Password</h2>

          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label htmlFor="settings-current-password" className="ah-label">
                Current password
              </label>
              <input
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                aria-invalid={Boolean(passwordErrors.current_password)}
                className="ah-input"
                required
              />
              {passwordErrors.current_password && (
                <p className="ah-error" role="alert">
                  {passwordErrors.current_password}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="settings-new-password" className="ah-label">
                  New password
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  aria-invalid={Boolean(passwordErrors.new_password)}
                  className="ah-input"
                  required
                />
                {passwordErrors.new_password && (
                  <p className="ah-error" role="alert">
                    {passwordErrors.new_password}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="settings-confirm-password" className="ah-label">
                  Confirm new password
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  aria-invalid={Boolean(passwordErrors.confirm_password)}
                  className="ah-input"
                  required
                />
                {passwordErrors.confirm_password && (
                  <p className="ah-error" role="alert">
                    {passwordErrors.confirm_password}
                  </p>
                )}
              </div>
            </div>
            <p className="ah-help">8–128 characters, with at least one letter and one digit.</p>

            <button
              type="submit"
              disabled={passwordSaving}
              className="ah-btn-secondary"
            >
              {passwordSaving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>
      )}

      <section className="ah-card flex flex-wrap items-center justify-between gap-4 p-4 lg:p-6" aria-labelledby="settings-session">
        <div className="min-w-0">
          <h2 id="settings-session" className="ah-h3">Session</h2>
          <p className="mt-1 break-words text-body text-ink-muted">
            Signed in as <span className="font-semibold text-ink-soft">{user.email ?? user.username}</span>
          </p>
        </div>
        <button type="button" onClick={() => void handleLogout()} className="ah-btn-secondary">
          Log out
        </button>
      </section>

      <section className="ah-card border-danger-line p-4 lg:p-6" aria-labelledby="settings-danger">
        <h2 id="settings-danger" className="ah-h3 text-danger">Danger zone</h2>

        <p className="my-3 text-body leading-relaxed text-ink-muted">
          Deleting your account is permanent. Your personal data is removed,
          but your questions and answers remain attributed to a deleted user.
        </p>

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="ah-btn-danger-outline"
        >
          Delete account
        </button>
      </section>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteModal}
        title="Delete your account?"
      >
        <form onSubmit={deleteAccount} className="space-y-4">
          <p className="text-body text-ink-muted">
            This action cannot be undone.
          </p>

          <div>
            <label htmlFor="delete-confirmation" className="ah-label">
              {user.has_password
                ? 'Enter your password to confirm'
                : 'Type DELETE to confirm'}
            </label>

            <input
              id="delete-confirmation"
              type={user.has_password ? 'password' : 'text'}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete={user.has_password ? 'current-password' : 'off'}
              aria-invalid={Boolean(deleteFieldError)}
              className="ah-input"
            />

            {deleteFieldError && (
              <p role="alert" className="ah-error">
                {deleteFieldError}
              </p>
            )}
          </div>

          {deleteError && (
            <p role="alert" className="ah-error">
              {deleteError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="ah-btn-ghost"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canDelete || deleting}
              className="ah-btn-danger"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
