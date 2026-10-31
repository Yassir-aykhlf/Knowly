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
  const { user, refresh } = useAuth()
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
    return <p className="p-8">Loading your account…</p>
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

    setPasswordErrors({})
    setPasswordSaving(true)

    try {
      await api.put('/users/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
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

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>

        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label htmlFor="settings-username" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <input
              id="settings-username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                setProfileErrors((old) => ({ ...old, username: '' }))
              }}
              aria-invalid={Boolean(profileErrors.username)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              required
            />
            {!USERNAME_RE.test(username) && username.length > 0 && (
              <p className="mt-1 text-sm text-amber-700">
                Use 3–30 letters, numbers, _ or -.
              </p>
            )}
            {profileErrors.username && (
              <p className="mt-1 text-sm text-red-600">
                {profileErrors.username}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="settings-bio" className="mb-1 block text-sm font-medium">
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
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
            <p className="text-xs text-slate-500">{bio.length}/500 characters</p>
            {bio.length > 500 && (
              <p className="text-sm text-red-600">
                Bio must be 500 characters or fewer.
              </p>
            )}
            {profileErrors.bio && (
              <p className="text-sm text-red-600">{profileErrors.bio}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={profileSaving || !USERNAME_RE.test(username) || bio.length > 500}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {profileSaving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Avatar</h2>

        <div className="mb-4 flex items-center gap-4">
          <Avatar user={user} size={64} />
          <span className="text-sm text-slate-500">Current profile picture</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm">
            Upload avatar
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
              className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              Remove avatar
            </button>
          )}
        </div>

        {avatarError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {avatarError}
          </p>
        )}
      </section>

      {user.has_password && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Password</h2>

          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label htmlFor="settings-current-password" className="mb-1 block text-sm font-medium">
                Current password
              </label>
              <input
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                required
              />
              {passwordErrors.current_password && (
                <p className="text-sm text-red-600">
                  {passwordErrors.current_password}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="settings-new-password" className="mb-1 block text-sm font-medium">
                New password
              </label>
              <input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                required
              />
              {passwordErrors.new_password && (
                <p className="text-sm text-red-600">
                  {passwordErrors.new_password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {passwordSaving ? 'Updating…' : 'Change password'}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-red-300 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700">Danger zone</h2>
        <p className="my-3 text-sm text-slate-600">
          Deleting your account is permanent. Your personal data is removed,
          but your questions and answers remain attributed to a deleted user.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white"
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
          <p className="text-sm text-slate-600">
            This action cannot be undone.
          </p>

          <div>
            <label htmlFor="delete-confirmation" className="mb-1 block text-sm font-medium">
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
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />

            {deleteFieldError && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {deleteFieldError}
              </p>
            )}
          </div>

          {deleteError && (
            <p role="alert" className="text-sm text-red-600">
              {deleteError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={deleting}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canDelete || deleting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
