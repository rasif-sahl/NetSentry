#!/usr/bin/env python3
"""Reproduce the checked-in Xcode source project; never invokes Apple tooling."""
from pathlib import Path
import plistlib
ROOT = Path(__file__).resolve().parents[1]
objects = {}; count = 0
def add(isa, fields):
    global count
    count += 1; key = f'B{count:023X}'; objects[key] = 'isa = ' + isa + '; ' + fields; return key
def sequence(ids): return '(' + ', '.join(ids) + ')'
def q(s): return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'
def configlist(settings, debug_settings=None):
    ids = []
    for mode in ['Debug','Release']:
        values = {**settings, **((debug_settings or {}) if mode == 'Debug' else {})}
        ids.append(add('XCBuildConfiguration', 'buildSettings = {' + ' '.join(f'{key} = {q(value)};' for key,value in values.items()) + '}; name = ' + mode + ';'))
    return add('XCConfigurationList',f'buildConfigurations = {sequence(ids)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
files = {}; products = []; targets = []
allpaths = sorted(str(p.relative_to(ROOT)) for p in ROOT.rglob('*.swift') if 'Tests' not in p.parts)
for path in allpaths:
    files[path] = add('PBXFileReference',f'lastKnownFileType = sourcecode.swift; path = {q(path)}; sourceTree = "<group>";')
app = [p for p in allpaths if p.startswith('NetSentry/')] + ['Shared/ScreenTimeStore.swift','Shared/ReportContext.swift']
shared = ['Shared/ScreenTimeStore.swift','NetSentry/Core/LocalScreenLease.swift','NetSentry/Core/JSONValue.swift']
def target(name, paths, bundle, info, extension=False, feature=False, dependencies=None, embedded=None):
    builds = [add('PBXBuildFile',f'fileRef = {files[p]};') for p in paths]
    phases = [add('PBXSourcesBuildPhase',f'buildActionMask = 2147483647; files = {sequence(builds)}; runOnlyForDeploymentPostprocessing = 0;'),add('PBXFrameworksBuildPhase','buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;'),add('PBXResourcesBuildPhase','buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')]
    if embedded:
        copies = [add('PBXBuildFile',f'fileRef = {p}; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy);}};') for p in embedded]
        phases.append(add('PBXCopyFilesBuildPhase',f'buildActionMask = 2147483647; dstPath = ""; dstSubfolderSpec = 13; files = {sequence(copies)}; name = "Embed App Extensions"; runOnlyForDeploymentPostprocessing = 0;'))
    product = add('PBXFileReference',f'explicitFileType = {"wrapper.app-extension" if extension else "wrapper.application"}; includeInIndex = 0; path = {q(name + (".appex" if extension else ".app"))}; sourceTree = BUILT_PRODUCTS_DIR;'); products.append(product)
    settings = dict(CODE_SIGN_STYLE='Automatic', CURRENT_PROJECT_VERSION='12',GENERATE_INFOPLIST_FILE='NO',INFOPLIST_FILE=info,MARKETING_VERSION='0.12.0',NETSENTRY_BUNDLE_PREFIX='com.netsentry.app',PRODUCT_BUNDLE_IDENTIFIER=bundle.replace('com.netsentry.app','$(NETSENTRY_BUNDLE_PREFIX)',1),PRODUCT_NAME='$(TARGET_NAME)',SUPPORTED_PLATFORMS='iphoneos',SUPPORTS_MACCATALYST='NO',TARGETED_DEVICE_FAMILY='1,2',NETSENTRY_APP_GROUP='')
    if extension: settings.update(APPLICATION_EXTENSION_API_ONLY='YES',SKIP_INSTALL='YES')
    if feature: settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) NETSENTRY_SCREEN_TIME'
    configs = configlist(settings, {'NETSENTRY_BUNDLE_PREFIX': 'com.netsentry.app.native.dev'})
    tid = add('PBXNativeTarget',f'buildConfigurationList = {configs}; buildPhases = {sequence(phases)}; buildRules = (); dependencies = {sequence(dependencies or [])}; name = {name}; productName = {name}; productReference = {product}; productType = "com.apple.product-type.{"app-extension" if extension else "application"}";'); targets.append(tid)
    return tid,product
extensions = []; deps = []
points = {'ActivityMonitor':'com.apple.deviceactivity.monitor-extension','ActivityReport':'com.apple.deviceactivityui.report-extension','ShieldConfiguration':'com.apple.ManagedSettingsUI.shield-configuration-service','ShieldAction':'com.apple.ManagedSettings.shield-action-service'}
for name,point in points.items():
    paths = [f'Extensions/{name}/{name}.swift']
    if name == 'ActivityMonitor': paths += shared
    if name == 'ActivityReport': paths += ['Shared/ReportContext.swift']
    tid, product = target(name,paths,'com.netsentry.app.'+name,f'Extensions/{name}/Info.plist',extension=True)
    extensions.append(product); deps.append(add('PBXTargetDependency',f'target = {tid};'))
    info = dict(CFBundleDisplayName=name,CFBundleExecutable='$(EXECUTABLE_NAME)',CFBundleIdentifier='$(PRODUCT_BUNDLE_IDENTIFIER)',CFBundleInfoDictionaryVersion='6.0',CFBundleName='$(PRODUCT_NAME)',CFBundlePackageType='XPC!',CFBundleShortVersionString='$(MARKETING_VERSION)',CFBundleVersion='$(CURRENT_PROJECT_VERSION)',NetSentryAppGroup='$(NETSENTRY_APP_GROUP)',NSExtension=dict(NSExtensionPointIdentifier=point))
    if name != 'ActivityReport': info['NSExtension']['NSExtensionPrincipalClass'] = '$(PRODUCT_MODULE_NAME).'+name
    (ROOT/f'Extensions/{name}/Info.plist').write_bytes(plistlib.dumps(info))
default,_ = target('NetSentry',app,'com.netsentry.app','NetSentry/Info.plist')
feature,_ = target('NetSentryScreenTime',app,'com.netsentry.app','NetSentry/Info.plist',feature=True,dependencies=deps,embedded=extensions)
productgroup = add('PBXGroup',f'children = {sequence(products)}; name = Products; sourceTree = "<group>";')
main = add('PBXGroup',f'children = {sequence(list(files.values())+[productgroup])}; sourceTree = "<group>";')
configs = configlist(dict(CLANG_ENABLE_MODULES='YES',SDKROOT='iphoneos',IPHONEOS_DEPLOYMENT_TARGET='17.0',SWIFT_VERSION='5.0'))
project = add('PBXProject',f'attributes = {{BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 1500;}}; buildConfigurationList = {configs}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = {main}; productRefGroup = {productgroup}; projectDirPath = ""; projectRoot = ""; targets = {sequence(targets)};')
(ROOT/'NetSentry.xcodeproj/project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+''.join(f'  {key} = {{{value}}};\n' for key,value in objects.items())+'}; rootObject = '+project+'; }\n')
scheme = (ROOT/'NetSentry.xcodeproj/xcshareddata/xcschemes/NetSentry.xcscheme').read_text()
import re
scheme = re.sub(r'BlueprintIdentifier="[^"]+"',f'BlueprintIdentifier="{default}"',scheme)
(ROOT/'NetSentry.xcodeproj/xcshareddata/xcschemes/NetSentry.xcscheme').write_text(scheme)
(ROOT/'NetSentry.xcodeproj/xcshareddata/xcschemes/NetSentryScreenTime.xcscheme').write_text(scheme.replace(default,feature).replace('NetSentry.app','NetSentryScreenTime.app').replace('BlueprintName="NetSentry"','BlueprintName="NetSentryScreenTime"'))
info = plistlib.loads((ROOT/'NetSentry/Info.plist').read_bytes()); info['NetSentryAppGroup']='$(NETSENTRY_APP_GROUP)'; (ROOT/'NetSentry/Info.plist').write_bytes(plistlib.dumps(info))
