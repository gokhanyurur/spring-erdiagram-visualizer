const JAVA_PRIMITIVE_TYPES = [
  "byte", "short", "int", "long", "float", "double", "char", "boolean"
];

const JAVA_COMMON_SIMPLE_TYPES = [
  "String", "Integer", "Float", "Double", "Long", "Boolean", "Date",
  "LocalDate", "LocalDateTime", "BigDecimal", "BigInteger",
  "UUID", "Instant", "LocalTime", "Short", "Byte", "Character",
  "Timestamp", "Time", "Calendar", "ZonedDateTime", "OffsetDateTime",
  "OffsetTime", "Duration", "Period", "URL", "URI", "Enum"
];

export const JAVA_PRIMITIVE_TYPES_AND_COMMONS = [
  ...JAVA_PRIMITIVE_TYPES,
  ...JAVA_COMMON_SIMPLE_TYPES
];
