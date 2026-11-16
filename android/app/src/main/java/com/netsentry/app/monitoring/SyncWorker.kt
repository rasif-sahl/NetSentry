package com.netsentry.app.monitoring

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.BackoffPolicy
import com.netsentry.app.data.EncryptedStore
import com.netsentry.app.data.Repository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/** OS scheduling is best effort. No boot receiver, foreground service or exact alarm is installed. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try { AppGraph.repository(applicationContext).sync(); Result.success() }
        catch (_: Exception) { if (runAttemptCount < 7) Result.retry() else Result.failure() }
    }
}
object AppGraph {
    @Volatile private var shared: Repository? = null
    fun repository(context: Context): Repository = shared ?: synchronized(this) {
        shared ?: Repository(EncryptedStore(context.applicationContext), AndroidUsageSource(context.applicationContext), { enabled ->
            val manager = WorkManager.getInstance(context.applicationContext)
            if (enabled) manager.enqueueUniquePeriodicWork("personal-usage-sync", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
            else manager.cancelUniqueWork("personal-usage-sync")
        }).also { shared = it }
    }
}
