/**
 * Error Handling Middleware
 */

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
};

/**
 * Global Error Handler
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors || err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid or expired token',
    });
  }

  // MySQL errors
  if (err.code && err.code.startsWith('ER_')) {
    // Duplicate entry
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A record with this value already exists',
      });
    }
    
    // Foreign key constraint
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        error: 'Invalid Reference',
        message: 'Referenced record does not exist',
      });
    }

    // Cannot delete due to foreign key
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete: record is referenced by other data',
      });
    }
  }

  // Default server error
  res.status(err.status || 500).json({
    error: 'Server Error',
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'An unexpected error occurred',
  });
};

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default {
  notFoundHandler,
  errorHandler,
  asyncHandler,
};
