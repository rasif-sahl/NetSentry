package com.netsentry.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.netsentry.app.data.Repository
import com.netsentry.app.monitoring.AppGraph
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

class PersonalViewModel(application: Application) : AndroidViewModel(application) {
    private var repository: Repository? = null
    private val actions = Mutex()
    var view by mutableStateOf<Repository.View?>(null)
        private set

    var busy by mutableStateOf(false)
        private set

    var message by mutableStateOf("")
        private set

    var exported by mutableStateOf<String?>(null)
        private set

    var exportKind by mutableStateOf("personal")
        private set

    init {
        run("Ready") {
            view() // Does not start collection on application launch.
            if (view().signedIn) refresh()
        }
    }

    fun run(success: String, action: Repository.() -> Unit) {
        viewModelScope.launch {
            actions.withLock {
                busy = true
                message = ""
                exported = null
                try {
                    val next =
                        withContext(Dispatchers.IO) {
                            val repo =
                                repository
                                    ?: AppGraph.repository(getApplication()).also {
                                        repository = it
                                    }
                            try {
                                repo.action()
                            } finally {
                                /* Snapshot read below also runs after a failed action. */
                            }
                            repo.view()
                        }
                    view = next
                    message = success
                } catch (error: Exception) {
                    view = withContext(Dispatchers.IO) { repository?.view() }
                    // No exception objects or payloads are logged or rendered.
                    message =
                        if (
                            error is com.netsentry.app.data.ApiFailure ||
                                error is IllegalArgumentException
                        )
                            error.message?.take(400) ?: "Request failed."
                        else
                            "Could not complete this action. Check connectivity, permissions or private storage and retry."
                } finally {
                    busy = false
                }
            }
        }
    }

    fun exportApplications() {
        exportKind = "applications"
        run("Application CSV ready") { exported = exportApplications() }
    }

    fun export(password: String) {
        exportKind = "personal"
        run("Personal export ready. Save it privately or close it.") { exported = export(password) }
    }

    fun closeExport() {
        exported = null
    }

    fun exportSaved() {
        exported = null
        message = "Export saved to the location you selected."
    }

    fun storageError() {
        message = "Could not save the export. Choose a private writable location and retry."
    }

    fun clearLocal() {
        viewModelScope.launch {
            actions.withLock {
                busy = true
                try {
                    withContext(Dispatchers.IO) {
                        // Also permits recovery from a lost/invalidated Keystore key.
                        repository?.clearLocal()
                            ?: run {
                                androidx.work.WorkManager.getInstance(getApplication())
                                    .cancelUniqueWork("personal-usage-sync")
                                com.netsentry.app.data.EncryptedStore(getApplication()).clear()
                            }
                    }
                    repository = null
                    view = null
                    exported = null
                    message =
                        "Local session, pairing and queued data cleared. Server records are unchanged."
                } finally {
                    busy = false
                }
            }
        }
    }
}
