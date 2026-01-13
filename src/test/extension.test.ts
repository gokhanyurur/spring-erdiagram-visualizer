import * as assert from 'assert';
import { parseJavaEntity, isCustomType } from '../utils/index.js';
import { generateMermaidFromEntities } from '../mermaidParser.js';
import { Entity } from '../models/index.js';

suite('parseJavaEntity', () => {
  test('returns null if @Entity is missing', () => {
    const java = `
      public class Foo {
        private int id;
      }
    `;
    const result = parseJavaEntity(java);
    assert.strictEqual(result, null);
  });

  test('returns null if class name is missing', () => {
    const java = `
      @Entity
      private int id;
    `;
    const result = parseJavaEntity(java);
    assert.strictEqual(result, null);
  });

  test('parses simple entity fields', () => {
    const java = `
      @Entity
      public class Foo {
        private int id;
        private String name;
      }
    `;
    const result = parseJavaEntity(java);
    assert.strictEqual(result?.name, 'Foo');
    assert.deepStrictEqual(result?.fields, [
      { type: 'int', name: 'id' },
      { type: 'String', name: 'name' }
    ]);
  });

  test('parses OneToMany relation', () => {
    const java = `
      @Entity
      public class Cart {
        @OneToMany
        private List<CartItem> cartItems;
      }
    `;
    const result = parseJavaEntity(java);
    assert.strictEqual(result?.relations.length, 1);
    assert.deepStrictEqual(result?.relations[0], {
      target: 'CARTITEM',
      type: 'OneToMany'
    });
    assert.deepStrictEqual(result?.fields[0], { type: 'List_CartItem', name: 'cartItems' });
  });

  test('parses ManyToOne relation', () => {
    const java = `
      @Entity
      public class CartItem {
        @ManyToOne
        private Cart cart;
      }
    `;
    const result = parseJavaEntity(java);
    assert.strictEqual(result?.relations.length, 1);
    assert.deepStrictEqual(result?.relations[0], {
      target: 'CART',
      type: 'ManyToOne'
    });
    assert.deepStrictEqual(result?.fields[0], { type: 'Cart', name: 'cart' });
  });

  test('parses @Enumerated and @Embedded fields', () => {
    const java = `
      @Entity
      public class Payment {
        @Enumerated
        private PaymentType type;
        @Embedded
        private CreditCard creditCard;
      }
    `;
    const result = parseJavaEntity(java);
    assert.deepStrictEqual(result?.fields, [
      { type: 'PaymentType', name: 'type' },
      { type: 'CreditCard', name: 'creditCard' }
    ]);
  });

  test('parses Map and Set relations', () => {
    const java = `
      @Entity
      public class Foo {
        private Map<String,Bar> bars;
        private Set<Baz> bazSet;
      }
    `;
    const result = parseJavaEntity(java);
    assert.deepStrictEqual(result?.fields[0], { type: 'Map_Bar', name: 'bars' });
    assert.deepStrictEqual(result?.fields[1], { type: 'Set_Baz', name: 'bazSet' });
    assert.strictEqual(result?.relations.length, 0);
  });

  test('parses custom type as ManyToOne relation', () => {
    const java = `
      @Entity
      public class Foo {
        private Bar bar;
      }
    `;
    const result = parseJavaEntity(java);
    assert.strictEqual(result?.relations.length, 0);
    assert.deepStrictEqual(result?.fields[0], { type: 'Bar', name: 'bar' });
  });
});

suite('isCustomType', () => {
  test('returns false for primitive types', () => {
    assert.strictEqual(isCustomType('int'), false);
    assert.strictEqual(isCustomType('String'), false);
    assert.strictEqual(isCustomType('Double'), false);
  });

  test('returns true for custom types', () => {
    assert.strictEqual(isCustomType('Foo'), true);
    assert.strictEqual(isCustomType('Bar'), true);
  });
});

suite('generateMermaidFromEntities', () => {
  test('generates Mermaid for multiple entities with relations', () => {
    const cartJava = `
      @Entity
      public class Cart {
        @OneToMany
        private List<CartItem> cartItems;
        private Double cartTotal;
        @OneToOne
        private Customer customer;
      }
    `;
    const cartItemJava = `
      @Entity
      public class CartItem {
        @ManyToOne
        private Cart cart;
        private String name;
      }
    `;
    const customerJava = `
      @Entity
      public class Customer {
        private String username;
        @OneToOne
        private Cart cart;
      }
    `;

    const cart = parseJavaEntity(cartJava);
    const cartItem = parseJavaEntity(cartItemJava);
    const customer = parseJavaEntity(customerJava);

    const entities = [cart, cartItem, customer] as Entity[];

    const mermaid = generateMermaidFromEntities(entities);

    // Assert entity blocks
    assert.match(mermaid, /CART \{\s+List_CartItem cartItems\s+Double cartTotal\s+Customer customer\s+/);
    assert.match(mermaid, /CARTITEM \{\s+Cart cart\s+String name\s+/);
    assert.match(mermaid, /CUSTOMER \{\s+String username\s+\s+Cart cart\s+/);

    // Assert relations
    assert.match(mermaid, /CART \|\|--o\{ CARTITEM : ""/); // OneToMany
    assert.match(mermaid, /CART \|\|--\|\| CUSTOMER : ""/); // OneToOne
  });

  test('avoids duplicate bidirectional relations', () => {
    const aJava = `
      @Entity
      public class A {
        @OneToOne
        private B b;
      }
    `;
    const bJava = `
      @Entity
      public class B {
        @OneToOne
        private A a;
      }
    `;
    const a = parseJavaEntity(aJava);
    const b = parseJavaEntity(bJava);
    const entities = [a, b] as Entity[];

    const mermaid = generateMermaidFromEntities(entities);

    // Only one relation line for bidirectional OneToOne
    const matches = mermaid.match(/A \|\|--\|\| B : ""/g);
    assert.ok(matches && matches.length === 1);
  });

  test('handles entity without access modifiers', () => {
    const java = `
      @Getter
      @Setter
      @SuperBuilder
      @NoArgsConstructor
      @Table(name = "foo_table", schema = "public")
      @Entity
      @EqualsAndHashCode(callSuper = true)
      public class Foo extends BaseEntity {

        @ManyToOne
        @JoinColumn(name = "bar_id", referencedColumnName = "id", nullable = false)
        BarEntity bar;
        UUID uuid;
        String name;
        Double value;
        @Enumerated(EnumType.STRING)
        Status status;
      }
    `;
    const foo = parseJavaEntity(java);
    const entities = [foo] as Entity[];

    const mermaid = generateMermaidFromEntities(entities);

    assert.match(mermaid, /FOO \{\s+BarEntity bar\s+UUID uuid\s+String name\s+Double value\s+Status status\s+/);
    assert.match(mermaid, /FOO \}o--\|\| BARENTITY : ""/);
  });

  test('handles entity with only regular columns', () => {
    const java = `
      @Entity
      public class Foo {
        private int id;
        private String name;
        private Double value;
      }
    `;
    const foo = parseJavaEntity(java);
    const entities = [foo] as Entity[];

    const mermaid = generateMermaidFromEntities(entities);

    assert.match(mermaid, /FOO \{\s+int id\s+String name\s+Double value\s+/);
    // No relations
    assert.ok(!/""/.test(mermaid));
  });

  test('handles ManyToMany relation', () => {
    const userJava = `
      @Entity
      public class User {
        private String username;
        private String email;
        @ManyToMany
        private List<Role> roles;
      }
    `;
    const roleJava = `
      @Entity
      public class Role {
        private String name;
        @ManyToMany
        private List<User> users;
      }
    `;
    const user = parseJavaEntity(userJava);
    const role = parseJavaEntity(roleJava);
    const entities = [user, role] as Entity[];

    const mermaid = generateMermaidFromEntities(entities);

    // Assert USER table fields
    assert.match(mermaid, /USER \{\s+String username\s+String email\s+List_Role roles\s+\}/);

    // Assert ROLE table fields
    assert.match(mermaid, /ROLE \{\s+String name\s+List_User users\s+\}/);

    // Only one relation line for bidirectional ManyToMany
    const matches = mermaid.match(/USER \}\|--\|\{ ROLE : ""/g);
    assert.ok(matches && matches.length === 1);
  });

  test('handles a real case complex project', () => {
    const addressJava = `
      @Getter
      @Setter
      @NoArgsConstructor
      @AllArgsConstructor
      @ToString
      @EqualsAndHashCode
      @Entity
      public class Address {
        
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer addressId;
        
        @Pattern(regexp = "[A-Za-z0-9\\s-]{3,}", message = "Not a valid street no")
        private String streetNo;
        
        @Pattern(regexp = "[A-Za-z0-9\\s-]{3,}", message = "Not a valid building name")
        private String buildingName;
        
        @NotNull
        @Pattern(regexp = "[A-Za-z0-9\\s-]{3,}", message = "Not a valid locality name")
        private String locality;
        
        @NotNull(message = "City name cannot be null")
        @Pattern(regexp = "[A-Za-z\\s]{2,}", message = "Not a valid city name")
        private String city;
        
        @NotNull(message = "State name cannot be null")
        private String state;
        
        @NotNull(message = "Pincode cannot be null")
        @Pattern(regexp = "[0-9]{6}", message = "Pincode not valid. Must be 6 digits")
        private String pincode;
        
        
        @ManyToOne(cascade = CascadeType.ALL)
        @JsonIgnore
        private Customer customer;
        
        
      }
    `;
    const cartJava = `
      @NoArgsConstructor
      @AllArgsConstructor
      @Data
      @Entity
      public class Cart {

        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer cartId;	

        private Double cartTotal;
        
        @OneToMany(cascade = CascadeType.ALL)
        private List<CartItem> cartItems = new ArrayList<>();
        
        @OneToOne(cascade = CascadeType.ALL)
        @JsonIgnore
        private Customer customer;

      }
    `;
    const cartItemJava = `
      @AllArgsConstructor
      @NoArgsConstructor
      @Getter
      @Setter
      @ToString
      @Entity
      public class CartItem {
        
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer cartItemId;
        
        
        @OneToOne
        @JsonIgnoreProperties(value={
            "productId",
            "seller",
            "quantity"
            
        })
        private Product cartProduct;
        
        private Integer cartItemQuantity;
        
      }
    `;
    const customerJava = `
      @Data
      @NoArgsConstructor
      @AllArgsConstructor
      @ToString
      @Entity
      public class Customer {
        
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer customerId;
        
        @NotNull(message = "First Name cannot be NULL")
        @Pattern(regexp = "[A-Za-z.\\s]+", message = "Enter valid characters in first name")
        private String firstName;
        
        @NotNull(message = "Last Name cannot be NULL")
        @Pattern(regexp = "[A-Za-z.\\s]+", message = "Enter valid characters in last name")
        private String lastName;
        
        @NotNull(message = "Please enter the mobile Number")
        @Column(unique = true)
        @Pattern(regexp = "[6789]{1}[0-9]{9}", message = "Enter valid 10 digit mobile number")
        private String mobileNo;
        
        
        @NotNull(message = "Please enter the emaild id")
        @Column(unique = true)
        @Email
        private String emailId;
        
        @NotNull(message = "Please enter the password")
        @Pattern(regexp = "[A-Za-z0-9!@#$%^&*_]{8,15}", message = "Password must be 8-15 characters in length and can include A-Z, a-z, 0-9, or special characters !@#$%^&*_")
        private String password;
        
        
        private LocalDateTime createdOn;
        
        @Embedded
        private CreditCard creditCard;
        
        
        @OneToMany(cascade = CascadeType.ALL)
        @JoinTable(name = "customer_address_mapping",
              joinColumns = {
                  @JoinColumn(name = "customer_id", referencedColumnName = "customerId")
              },
              inverseJoinColumns = {
                  @JoinColumn(name = "address_id", referencedColumnName = "addressId")
              })
        private Map<String, Address> address = new HashMap<>();
        
        

        
        
      //	Establishing Customer - Order relationship
        @OneToMany(cascade = CascadeType.ALL, mappedBy = "customer")
        private List<Order> orders = new ArrayList<>();
        
        
        
      //	Establishing Customer - Cart relationship
      //	
        @OneToOne(cascade = CascadeType.ALL)
        private Cart customerCart;
        
        
        
      }
    `;
    const orderJava = `
      @Setter
      @Getter
      @NoArgsConstructor
      @AllArgsConstructor
      @ToString
      @Entity
      @Table(name="orders")
      public class Order {
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer orderId;
        @PastOrPresent
        private LocalDate date;
        @NotNull
        @Enumerated(EnumType.STRING)
        private OrderStatusValues orderStatus;
        
        private Double total;
        
        private String cardNumber;
        
        @JsonIgnore
        @ManyToOne
        @JoinColumn(name = "customer_id", referencedColumnName = "customerId")
        private Customer customer;
        
        @OneToMany
        private List<CartItem> ordercartItems = new ArrayList<>();
        
        @ManyToOne
        @JoinColumn(name = "address_id", referencedColumnName = "addressId")
        private Address address;
      }

    `;
    const productJava = `
      @Entity
      @Setter
      @Getter
      @AllArgsConstructor
      @NoArgsConstructor
      @ToString
      @EqualsAndHashCode
      public class Product {

        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer productId;

        @NotNull
        @Size(min = 3, max = 30, message = "Product name size should be between 3-30")
        private String productName;

        @NotNull
        @DecimalMin(value = "0.00")
        private Double price;

        private String description;

        @NotNull
        private String manufacturer;

        @NotNull
        @Min(value = 0)
        private Integer quantity;

        @Enumerated(EnumType.STRING)
        private CategoryEnum category;

        @Enumerated(EnumType.STRING)
        private ProductStatus status;

      //	@ManyToMany(cascade = CascadeType.ALL)
      //	private Order order;

        @ManyToOne(cascade = CascadeType.ALL)
        @JsonIgnore
        private Seller seller;

      //	@ManyToMany
      //	@JsonIgnore
      //	private List<Cart> productCarts = new ArrayList<>();

      }
    `;
    const sellerJava = `
      @Entity
      @Getter
      @Setter
      @NoArgsConstructor
      @AllArgsConstructor
      public class Seller {
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer sellerId;
        
        @NotNull(message="Please enter the first name")
        @Pattern(regexp="[A-Za-z\\s]+", message="First Name should contains alphabets only")
        private String firstName;
        
        @NotNull(message="Please enter the last name")
        @Pattern(regexp="[A-Za-z\\s]+", message="First Name should contains alphabets only")
        private String lastName;
        
        @Pattern(regexp="[A-Za-z0-9!@#$%^&*_]{8,15}", message="Please Enter a valid Password")
        private String password;
        
        @NotNull(message="Please enter your mobile Number")
        @Pattern(regexp="[6789]{1}[0-9]{9}", message="Enter a valid Mobile Number")
        @Column(unique = true)
        private String mobile;
        
        
        @Email
        @Column(unique = true)
        private String emailId;
        

        @OneToMany
        @JsonIgnore
        private List<Product> product;
        

      }
    `;
    const userSessionJava = `
      @Data
      @NoArgsConstructor
      @AllArgsConstructor
      @Entity
      public class UserSession {
        
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private Integer sessionId;
        
        @Column(unique = true)
        private String token;
        
        @Column(unique = true)
        private Integer userId;
        
        private String userType;
        
        private LocalDateTime sessionStartTime;
        
        private LocalDateTime sessionEndTime;
        
      }
    `;

    const address = parseJavaEntity(addressJava);
    const cart = parseJavaEntity(cartJava);
    const cartItem = parseJavaEntity(cartItemJava);
    const customer = parseJavaEntity(customerJava);
    const order = parseJavaEntity(orderJava);
    const product = parseJavaEntity(productJava);
    const seller = parseJavaEntity(sellerJava);
    const userSession = parseJavaEntity(userSessionJava);

    const entities = [
      address,
      cart,
      cartItem,
      customer,
      order,
      product,
      seller,
      userSession,
    ] as Entity[];

    const mermaid = generateMermaidFromEntities(entities);

    assert.match(mermaid, /ADDRESS \{\s+Integer addressId\s+String streetNo\s+String buildingName\s+String locality\s+String city\s+String state\s+String pincode\s+Customer customer\s+\}/);
    assert.match(mermaid, /CART \{\s+Integer cartId\s+Double cartTotal\s+List_CartItem cartItems\s+Customer customer\s+\}/);
    assert.match(mermaid, /CARTITEM \{\s+Integer cartItemId\s+Product cartProduct\s+Integer cartItemQuantity\s+\}/);
    assert.match(mermaid, /CUSTOMER \{\s+Integer customerId\s+String firstName\s+String lastName\s+String mobileNo\s+String emailId\s+String password\s+LocalDateTime createdOn\s+CreditCard creditCard\s+Map_Address address\s+List_Order orders\s+Cart customerCart\s+\}/);
    assert.match(mermaid, /ORDER \{\s+Integer orderId\s+LocalDate date\s+OrderStatusValues orderStatus\s+Double total\s+String cardNumber\s+Customer customer\s+List_CartItem ordercartItems\s+Address address\s+\}/);
    assert.match(mermaid, /PRODUCT \{\s+Integer productId\s+String productName\s+Double price\s+String description\s+String manufacturer\s+Integer quantity\s+CategoryEnum category\s+ProductStatus status\s+Seller seller\s+\}/);
    assert.match(mermaid, /SELLER \{\s+Integer sellerId\s+String firstName\s+String lastName\s+String password\s+String mobile\s+String emailId\s+List_Product product\s+\}/);
    assert.match(mermaid, /USERSESSION \{\s+Integer sessionId\s+String token\s+Integer userId\s+String userType\s+LocalDateTime sessionStartTime\s+LocalDateTime sessionEndTime\s+\}/);

    // Relations
    assert.match(mermaid, /ADDRESS \}o--\|\| CUSTOMER : ""/);
    assert.match(mermaid, /CART \|\|--o\{ CARTITEM : ""/);
    assert.match(mermaid, /CART \|\|--\|\| CUSTOMER : ""/);
    assert.match(mermaid, /CARTITEM \|\|--\|\| PRODUCT : ""/);
    assert.match(mermaid, /CUSTOMER \|\|--o\{ ORDER : ""/);
    assert.match(mermaid, /ORDER \|\|--o\{ CARTITEM : ""/);
    assert.match(mermaid, /ORDER \}o--\|\| ADDRESS : ""/);
    assert.match(mermaid, /PRODUCT \}o--\|\| SELLER : ""/);
  });

  test('handles entity with builder class inside', () => {
    const withInnterBuilderClass = `
    @Entity
    public class MessageIncoming {
      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;

      private UUID uuid;

      public UUID getUuid() {
        return uuid;
      }

      public void setUuid(UUID uuid) {
        this.uuid = uuid;
      }

      private LocalDateTime createdAt;
      private LocalDateTime updatedAt;

      @ManyToOne
      @JoinColumn(name = "sender_id")
      private Sender sender;

      @ManyToOne
      @JoinColumn(name = "card_id")
      private Card card;

      private String body;

      private Double sellPrice;

      @Enumerated(EnumType.STRING)
      private CurrencyEnum sellCurrency;

      public void setBody(String body) {
        this.body = body;
      }

      private String msisdn;

      public String getMsisdn() {
        return msisdn;
      }

      @Enumerated(EnumType.STRING)
      private MessageIncomingStatusEnum status;

      @ManyToOne
      @JoinColumn(name = "destination_id", nullable = false)
      private Destination destination;

      @Column(nullable = false)
      private Integer requestId;

      public MessageIncoming() {
      }

      private MessageIncoming(Builder builder) {
        status = MessageIncomingStatusEnum.LOCAL_PENDING;
        body = builder.body;
        card = builder.card;
        sender = builder.sender;
        destination = builder.destination;
        requestId = builder.requestId;
        msisdn = builder.msisdn;
        uuid = UuidCreator.getTimeOrderedEpoch();
      }

      public static Builder builder() {
        return new Builder();
      }

      public static class Builder {
        private String body;
        private String msisdn;
        private Card card;
        private Sender sender;
        private Destination destination;
        private Integer requestId;

        public Builder body(String body) {
          this.body = body;
          return this;
        }

        public Builder card(Card card) {
          this.card = card;
          return this;
        }

        public Builder sender(Sender sender) {
          this.sender = sender;
          return this;
        }

        public Builder msisdn(String msisdn) {
          this.msisdn = msisdn;
          return this;
        }

        public Builder destination(Destination destination) {
          this.destination = destination;
          return this;
        }

        public Builder requestId(Integer requestId) {
          this.requestId = requestId;
          return this;
        }

        public MessageIncoming build() {
          return new MessageIncoming(this);
        }
      }

      public Long getId() {
        return id;
      }

      public LocalDateTime getCreatedAt() {
        return createdAt;
      }

      public LocalDateTime getUpdatedAt() {
        return updatedAt;
      }

      public Sender getSender() {
        return sender;
      }

      public Card getCard() {
        return card;
      }

      public String getBody() {
        return body;
      }

      public MessageIncomingStatusEnum getStatus() {
        return status;
      }

      public Destination getDestination() {
        return destination;
      }

      public Integer getRequestId() {
        return requestId;
      }

      @PreUpdate
      protected void onUpdate() {
        updatedAt = LocalDateTime.now();
      }

      @PrePersist
      protected void onPersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
      }
    }
    `;
    const messageIncoming = parseJavaEntity(withInnterBuilderClass);
    const entities = [messageIncoming] as Entity[];
    const mermaid = generateMermaidFromEntities(entities);
    assert.match(mermaid, /MESSAGEINCOMING \{\s+Long id\s+UUID uuid\s+LocalDateTime createdAt\s+LocalDateTime updatedAt\s+Sender sender\s+Card card\s+String body\s+Double sellPrice\s+CurrencyEnum sellCurrency\s+String msisdn\s+MessageIncomingStatusEnum status\s+Destination destination\s+Integer requestId\s+\}/);
    assert.match(mermaid, /MESSAGEINCOMING \}o--\|\| SENDER : ""/);
    assert.match(mermaid, /MESSAGEINCOMING \}o--\|\| CARD : ""/);
    assert.match(mermaid, /MESSAGEINCOMING \}o--\|\| DESTINATION : ""/);
  });

  test('handles relation annotation on getter', () => {
    const orderJava = `
    @Entity
    public class Order {
      @Id
      private Long id;

      private List<OrderItem> items;

      @OneToMany(mappedBy = "order", fetch = FetchType.EAGER, cascade = CascadeType.ALL)
      public List<OrderItem> getItems() {
        return items;
      }
    }
    `;

    const order = parseJavaEntity(orderJava);
    const entities = [order] as Entity[];
    const mermaid = generateMermaidFromEntities(entities);

    assert.match(mermaid, /ORDER \{\s+Long id\s+List_OrderItem items\s+\}/);
    assert.match(mermaid, /ORDER \|\|--o\{ ORDERITEM : ""/);
  });
});
