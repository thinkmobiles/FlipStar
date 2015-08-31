module.exports = {
    FRIENDS: 'friends',

    FB_LIMITS: {
        DEFAULT: parseInt(50000/7),
        LEVEL_1: 10000,
        GROWTH_1: parseInt(75000/7),
        LEVEL_2: 15000,
        GROWTH_2: parseInt(100000/7),
        LEVEL_3: 20000,
        GROWTH_3: parseInt(150000/7),
        LEVEL_4: 30000,
        GROWTH_4: parseInt(300000/7),
        LEVEL_5: 60000,
        GROWTH_5: parseInt(500000/7),
        LEVEL_6: 100000,
        GROWTH_6: parseInt(1000000/7),
        LEVEL_7: 200000,
        GROWTH_7: parseInt(2000000/7),
        LEVEL_8: 400000,
        GROWTH_8: parseInt(4000000/7),
        LEVEL_9: 800000,
        GROWTH_9: parseInt(8000000/7),
        LEVEL_10: 1600000,
        GROWTH_10: parseInt(16000000/7),
        LEVEL_11: 3200000,
        GROWTH_11: parseInt(32000000/7)
    },
    FB_NOTIFICATION_MESSAGES: [
        'Message for group B',
        'Message for group C',
        'Message for group D',
        'Message for group E',
        'Message for group A'
    ],

    PURCHASE_GROUP_USERS: {
        GROUP_A: 'A',
        GROUP_B: 'B',
        GROUP_C: 'C'
    },

    CURRENCY_TYPE: {
        REAL: 0,
        SOFT: 1
    },

    ACTION: {
        OPEN: 0,
        BUY: 1
    },

    SMASH_DEFAULT_PRICE: 100,
    FLIPS_PER_HOUR: 5
};