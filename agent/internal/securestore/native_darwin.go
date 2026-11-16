//go:build darwin && cgo

package securestore

/*
#cgo LDFLAGS: -framework Security -framework CoreFoundation
#include <Security/Security.h>
#include <stdlib.h>
#include <string.h>
static CFMutableDictionaryRef credentialQuery(char *service,char *account){
 CFMutableDictionaryRef query=CFDictionaryCreateMutable(NULL,0,&kCFTypeDictionaryKeyCallBacks,&kCFTypeDictionaryValueCallBacks);
 CFStringRef s=CFStringCreateWithCString(NULL,service,kCFStringEncodingUTF8),a=CFStringCreateWithCString(NULL,account,kCFStringEncodingUTF8);
 CFDictionarySetValue(query,kSecClass,kSecClassGenericPassword);CFDictionarySetValue(query,kSecAttrService,s);CFDictionarySetValue(query,kSecAttrAccount,a);CFRelease(s);CFRelease(a);return query;
}
static OSStatus readCredential(char *service,char *account,void **data,UInt32 *length){
 CFMutableDictionaryRef query=credentialQuery(service,account);CFDictionarySetValue(query,kSecReturnData,kCFBooleanTrue);CFDictionarySetValue(query,kSecMatchLimit,kSecMatchLimitOne);CFTypeRef result=NULL;OSStatus status=SecItemCopyMatching(query,&result);CFRelease(query);if(status!=errSecSuccess)return status;
 if(CFGetTypeID(result)!=CFDataGetTypeID()||CFDataGetLength((CFDataRef)result)>16384){CFRelease(result);return errSecDecode;}
 *length=(UInt32)CFDataGetLength((CFDataRef)result);*data=malloc(*length);if(*length&&!*data){CFRelease(result);return errSecAllocate;}memcpy(*data,CFDataGetBytePtr((CFDataRef)result),*length);CFRelease(result);return errSecSuccess;
}
static OSStatus writeCredential(char *service,char *account,char *data,UInt32 length){
 CFMutableDictionaryRef query=credentialQuery(service,account),attributes=CFDictionaryCreateMutable(NULL,0,&kCFTypeDictionaryKeyCallBacks,&kCFTypeDictionaryValueCallBacks);CFDataRef value=CFDataCreate(NULL,(UInt8*)data,length);CFDictionarySetValue(attributes,kSecValueData,value);OSStatus status=SecItemUpdate(query,attributes);if(status==errSecItemNotFound){CFDictionarySetValue(query,kSecValueData,value);status=SecItemAdd(query,NULL);}CFRelease(value);CFRelease(attributes);CFRelease(query);return status;
}
static OSStatus deleteCredential(char *service,char *account){CFMutableDictionaryRef query=credentialQuery(service,account);OSStatus status=SecItemDelete(query);CFRelease(query);return status==errSecItemNotFound?errSecSuccess:status;}
*/
import "C"
import (
	"errors"
	"unsafe"
)

type keychain struct{ installation string }

func Native(id string) (Store, error) { return keychain{id}, nil }
func (k keychain) names(key string) (*C.char, *C.char) {
	return C.CString("NetSentry.agent." + k.installation), C.CString(key)
}
func (k keychain) Get(key string) (string, error) {
	service, account := k.names(key)
	defer C.free(unsafe.Pointer(service))
	defer C.free(unsafe.Pointer(account))
	var data unsafe.Pointer
	var length C.UInt32
	status := C.readCredential(service, account, &data, &length)
	if status == C.errSecItemNotFound {
		return "", ErrNotFound
	}
	if status != C.errSecSuccess {
		return "", errors.New("macOS Keychain credential access failed")
	}
	defer C.free(data)
	return string(C.GoBytes(data, C.int(length))), nil
}
func (k keychain) Set(key, value string) error {
	if len(value) > 16384 {
		return errors.New("credential exceeds supported size")
	}
	service, account := k.names(key)
	defer C.free(unsafe.Pointer(service))
	defer C.free(unsafe.Pointer(account))
	data := C.CString(value)
	defer C.free(unsafe.Pointer(data))
	if C.writeCredential(service, account, data, C.UInt32(len(value))) != C.errSecSuccess {
		return errors.New("macOS Keychain credential write failed")
	}
	return nil
}
func (k keychain) Delete(key string) error {
	service, account := k.names(key)
	defer C.free(unsafe.Pointer(service))
	defer C.free(unsafe.Pointer(account))
	if C.deleteCredential(service, account) != C.errSecSuccess {
		return errors.New("macOS Keychain credential deletion failed")
	}
	return nil
}
