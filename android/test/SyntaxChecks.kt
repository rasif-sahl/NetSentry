import com.intellij.openapi.util.Disposer
import com.intellij.psi.PsiErrorElement
import com.intellij.psi.util.PsiTreeUtil
import org.jetbrains.kotlin.cli.jvm.compiler.EnvironmentConfigFiles
import org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment
import org.jetbrains.kotlin.config.CompilerConfiguration
import org.jetbrains.kotlin.psi.KtPsiFactory
import java.io.File

fun main(args: Array<String>) {
    val disposable = Disposer.newDisposable()
    try {
        val environment = KotlinCoreEnvironment.createForProduction(disposable, CompilerConfiguration(), EnvironmentConfigFiles.JVM_CONFIG_FILES)
        val factory = KtPsiFactory(environment.project, false)
        val files = File(args.single()).walkTopDown().filter { it.extension == "kt" }.toList()
        check(files.isNotEmpty())
        files.forEach { source ->
            val parsed = factory.createFile(source.name, source.readText())
            val errors = PsiTreeUtil.findChildrenOfType(parsed, PsiErrorElement::class.java)
            check(errors.isEmpty()) { "${source.path}: ${errors.joinToString { it.errorDescription + " at " + it.textOffset }}" }
        }
        println("Parsed ${files.size} Kotlin source files; Android/Compose type checking still requires a native build.")
    } finally { Disposer.dispose(disposable) }
}
