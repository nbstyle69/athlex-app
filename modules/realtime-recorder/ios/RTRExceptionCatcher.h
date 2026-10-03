#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Runs `block` and returns the NSException it raised, or nil. Swift cannot
/// catch Objective-C exceptions, and AVCaptureSession raises them
/// (`startRunning` between `beginConfiguration` / `commitConfiguration`,
/// unsupported preset…): uncaught, they kill the app.
NSException * _Nullable RTRCatchException(void (NS_NOESCAPE ^block)(void));

NS_ASSUME_NONNULL_END
