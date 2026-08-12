// studio/core/auth/db.js
import { ObjectId } from 'mongodb';
import { clientPromise } from '../db/adapters/mongodb';
import bcrypt from 'bcryptjs';

export async function getWebappDB() {
    const client = await clientPromise;
    if (!client) {
        console.warn('MongoDB client not available - getWebappDB returning null');
        return null;
    }
    return client.db(process.env.WEBAPP_DB_NAME || 'apps_db');
}

export async function createAuthIndexes() {
    const client = await clientPromise;
    if (!client) {
        console.warn('MongoDB client not available - skipping auth indexes creation');
        return;
    }
    const db = client.db(process.env.WEBAPP_DB_NAME || 'apps_db');

    await db.collection('app_users').createIndexes([
        { key: { email: 1, startupId: 1 }, unique: true },
        { key: { email: 1 } },
        { key: { startupId: 1 } }
    ]);

    await db.collection('app_sessions').createIndexes([
        { key: { sessionToken: 1 }, unique: true },
        { key: { userId: 1 } }
    ]);

    await db.collection('app_verification_tokens').createIndexes([
        { key: { identifier: 1, token: 1 }, unique: true }
    ]);
}

export const WebappUsers = {
    async createUser(userData) {
        const db = await getWebappDB();
        const { email, startupId, name, password } = userData;

        // Check if user exists
        const existingUser = await db.collection('app_users').findOne({
            email,
            startupId: new ObjectId(startupId)
        });

        if (existingUser) {
            throw new Error('User already exists');
        }

        // Hash password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
            email,
            name,
            startupId: new ObjectId(startupId),
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {}
        };

        const result = await db.collection('app_users').insertOne(user);
        return { ...user, _id: result.insertedId };
    },

    async validateUser(startupId, email, password) {
        const db = await getWebappDB();
        const user = await db.collection('app_users').findOne({
            email,
            startupId: new ObjectId(startupId)
        });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return null;
        }

        return user;
    },

    async findUserByEmail(email, startupId) {
        const db = await getWebappDB();
        return db.collection('app_users').findOne({
            email,
            startupId: new ObjectId(startupId)
        });
    },

    async createUserWithMagicLink(email, startupId) {
        const db = await getWebappDB();
        const user = {
            email,
            startupId: new ObjectId(startupId),
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {}
        };

        const result = await db.collection('app_users').insertOne(user);
        return await db.collection('app_users').findOne({
            _id: result.insertedId
        });
    },

    async findUserById(userId, startupId) {
        const db = await getWebappDB();
        const user = await db.collection('app_users').findOne({
            _id: new ObjectId(userId),
            startupId: new ObjectId(startupId)
        });

        if (!user) return null;

        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            startupId: user.startupId.toString(),
            metadata: user.metadata || {}
        };
    }
};
