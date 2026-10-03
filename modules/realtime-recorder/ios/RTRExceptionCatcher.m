#import "RTRExceptionCatcher.h"

NSException *RTRCatchException(void (NS_NOESCAPE ^block)(void)) {
  @try {
    block();
    return nil;
  } @catch (NSException *exception) {
    return exception;
  }
}
