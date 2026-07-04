"use strict";

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[source];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: result.error.errors,
      });
    }

    if (source === 'body') {
      req.body = result.data;
    } else {
      Object.keys(req[source]).forEach(k => delete req[source][k]);
      Object.assign(req[source], result.data);
    }
    return next();
  };
}

module.exports = validate;
