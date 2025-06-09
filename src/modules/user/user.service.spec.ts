import { UserService } from './user.service';
import { getUserModel } from './user.model';
import { hashPassword } from '../../utils/hash';
import { CreateUserInput, UpdateUserInput, UserRole } from './user.schema';
import { User } from './types';
import { DatabaseError, NotFoundError, ValidationError } from '../../utils/errors';

// Mock dependencies
jest.mock('./user.model');
jest.mock('../../utils/hash');
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    startOperation: jest.fn().mockReturnValue('logContext'),
    endOperation: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    errorOperation: jest.fn(),
    logMetric: jest.fn(), // Added missing mock
  }),
}));

const mockUserModel = {
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findOne: jest.fn(), // Added for findOrCreateByGoogleProfile and potentially others
  // save: jest.fn(), // instance method, will be on mocked documents
  // toObject: jest.fn(), // instance method
};

const mockUserDoc = (data: Partial<User & { _id: string }>) => ({
  ...data,
  _id: data.id || 'mockId',
  email: data.email || 'test@example.com',
  role: data.role || 'viewer',
  createdAt: data.createdAt || new Date(),
  updatedAt: data.updatedAt || new Date(),
  toObject: jest.fn().mockReturnValue({
    _id: data.id || 'mockId',
    id: data.id || 'mockId',
    name: null, // Default to null if not provided
    googleId: null, // Default to null
    password: null, // Default to null
    ...data,
  }),
  save: jest.fn().mockResolvedValue({ // Mock save if called on document instance
    ...data,
    toObject: jest.fn().mockReturnValue(data),
  }),
});

describe('UserService', () => {
  let userService: UserService;
  let mockFastify: any;

  beforeEach(() => {
    jest.clearAllMocks();

    (getUserModel as jest.Mock).mockReturnValue(mockUserModel);
    (hashPassword as jest.Mock).mockResolvedValue('hashedPassword');

    mockFastify = {
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
      // Mock other fastify properties if userService uses them
    };
    userService = new UserService(mockFastify);
  });

  // --- convertToUser --- (Helper, tested implicitly or explicitly if complex)
  describe('convertToUser', () => {
    it('should correctly convert a user document', () => {
      const userDocData = {
        _id: 'mongoId123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as UserRole,
        googleId: 'google123',
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const userDoc = { // Simpler mock for this specific test
        toObject: jest.fn().mockReturnValue(userDocData),
      };
      // @ts-ignore // Bypass private method access for testing
      const result = userService.convertToUser(userDoc as any);
      expect(userDoc.toObject).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'mongoId123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        googleId: 'google123',
        password: 'hashedPassword',
        createdAt: userDocData.createdAt,
        updatedAt: userDocData.updatedAt,
      });
    });

     it('should handle missing optional fields', () => {
      const userDocData = {
        _id: 'mongoId456',
        email: 'noOptional@example.com',
        role: 'viewer' as UserRole,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
       const userDoc = {
        toObject: jest.fn().mockReturnValue(userDocData),
      };
      // @ts-ignore
      const result = userService.convertToUser(userDoc as any);
      expect(result).toEqual({
        id: 'mongoId456',
        email: 'noOptional@example.com',
        name: null,
        role: 'viewer',
        googleId: null,
        password: null,
        createdAt: userDocData.createdAt,
        updatedAt: userDocData.updatedAt,
      });
    });
  });

  // --- createUser ---
  describe('createUser', () => {
    const createUserData: CreateUserInput = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
      role: 'editor',
    };

    it('should create a user successfully', async () => {
      const createdDoc = mockUserDoc({ ...createUserData, id: 'newId' });
      mockUserModel.create.mockResolvedValue(createdDoc);

      const result = await userService.createUser(createUserData);

      expect(hashPassword).toHaveBeenCalledWith('password123');
      expect(mockUserModel.create).toHaveBeenCalledWith({
        ...createUserData,
        password: 'hashedPassword',
        role: 'editor',
      });
      expect(result.email).toBe(createUserData.email);
      expect(result.name).toBe(createUserData.name);
      expect(result.id).toBe('newId');
    });

    it('should throw ValidationError for duplicate email', async () => {
      mockUserModel.create.mockRejectedValue({ message: 'duplicate key error' });
      await expect(userService.createUser(createUserData)).rejects.toThrow(ValidationError);
    });

    it('should throw DatabaseError for other creation errors', async () => {
      mockUserModel.create.mockRejectedValue(new Error('Some DB error'));
      await expect(userService.createUser(createUserData)).rejects.toThrow(DatabaseError);
    });
  });

  // --- getAllUsers ---
  describe('getAllUsers', () => {
    it('should return a list of users', async () => {
      const userDocs = [mockUserDoc({ id: '1', email: 'a@a.com' }), mockUserDoc({ id: '2', email: 'b@b.com' })];
      mockUserModel.find.mockResolvedValue(userDocs);
      const results = await userService.getAllUsers();
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('1');
      expect(mockUserModel.find).toHaveBeenCalledWith({});
    });

    it('should return an empty list if no users', async () => {
      mockUserModel.find.mockResolvedValue([]);
      const results = await userService.getAllUsers();
      expect(results.length).toBe(0);
    });

    it('should throw DatabaseError on error', async () => {
      mockUserModel.find.mockRejectedValue(new Error('DB find error'));
      await expect(userService.getAllUsers()).rejects.toThrow(DatabaseError);
    });
  });

  // --- getUserById ---
  describe('getUserById', () => {
    it('should return user if found', async () => {
      const userDoc = mockUserDoc({ id: 'userId1', email: 'found@example.com' });
      mockUserModel.findById.mockResolvedValue(userDoc);
      const result = await userService.getUserById('userId1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('userId1');
      expect(mockUserModel.findById).toHaveBeenCalledWith('userId1');
    });

    it('should return null if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);
      const result = await userService.getUserById('unknownId');
      expect(result).toBeNull();
    });

    it('should throw ValidationError for invalid ID format (CastError)', async () => {
      const castError = new Error('CastError: Invalid ID') as any;
      castError.name = 'CastError';
      mockUserModel.findById.mockRejectedValue(castError);
      await expect(userService.getUserById('invalidIdFormat')).rejects.toThrow(ValidationError);
    });

    it('should throw DatabaseError for other errors', async () => {
      mockUserModel.findById.mockRejectedValue(new Error('DB error'));
      await expect(userService.getUserById('someId')).rejects.toThrow(DatabaseError);
    });
  });

  // --- updateUser ---
  describe('updateUser', () => {
    const updateData: UpdateUserInput = { name: 'Updated Name', role: 'admin' };
    const userId = 'userToUpdateId';

    it('should update and return user if found', async () => {
      const initialDoc = mockUserDoc({ id: userId, name: 'Old Name', role: 'viewer' });
      // save method on the document instance should return the updated doc
      const updatedDocInstance = mockUserDoc({ id: userId, ...updateData });
      initialDoc.save = jest.fn().mockResolvedValue(updatedDocInstance); // mock save on this instance
      mockUserModel.findById.mockResolvedValue(initialDoc);

      const result = await userService.updateUser(userId, updateData);

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(initialDoc.name).toBe(updateData.name);
      expect(initialDoc.role).toBe(updateData.role);
      expect(initialDoc.save).toHaveBeenCalled();
      expect(result.name).toBe(updateData.name);
    });

    it('should only update provided fields', async () => {
      const partialUpdate: UpdateUserInput = { name: 'Partially Updated' };
      const initialDoc = mockUserDoc({ id: userId, name: 'Original', email: 'original@e.com', role: 'viewer' });
      const updatedDocInstance = mockUserDoc({ ...initialDoc, name: partialUpdate.name });
      initialDoc.save = jest.fn().mockResolvedValue(updatedDocInstance);
      mockUserModel.findById.mockResolvedValue(initialDoc);

      await userService.updateUser(userId, partialUpdate);
      expect(initialDoc.name).toBe(partialUpdate.name);
      expect(initialDoc.email).toBe('original@e.com'); // Email should not change
      expect(initialDoc.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError if user to update is not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);
      await expect(userService.updateUser(userId, updateData)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for duplicate email on update', async () => {
      const userDoc = mockUserDoc({ id: userId });
      userDoc.save = jest.fn().mockRejectedValue({ message: 'duplicate key error' });
      mockUserModel.findById.mockResolvedValue(userDoc);
      await expect(userService.updateUser(userId, { email: 'duplicate@example.com' })).rejects.toThrow(ValidationError);
    });

    it('should throw DatabaseError for other update errors', async () => {
      const userDoc = mockUserDoc({ id: userId });
      userDoc.save = jest.fn().mockRejectedValue(new Error('DB save error'));
      mockUserModel.findById.mockResolvedValue(userDoc);
      await expect(userService.updateUser(userId, updateData)).rejects.toThrow(DatabaseError);
    });
  });

  // --- deleteUser ---
  describe('deleteUser', () => {
    const userId = 'userToDeleteId';

    it('should delete user and return confirmation', async () => {
      const userDoc = mockUserDoc({ id: userId });
      mockUserModel.findById.mockResolvedValue(userDoc); // For the find check
      mockUserModel.findByIdAndDelete.mockResolvedValue(userDoc); // For the actual deletion

      const result = await userService.deleteUser(userId);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ success: true, message: 'User deleted successfully', userId });
    });

    it('should throw NotFoundError if user to delete is not found', async () => {
      mockUserModel.findById.mockResolvedValue(null); // findById check fails
      await expect(userService.deleteUser(userId)).rejects.toThrow(NotFoundError);
      expect(mockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError for other deletion errors', async () => {
      const userDoc = mockUserDoc({ id: userId });
      mockUserModel.findById.mockResolvedValue(userDoc); // findById check passes
      mockUserModel.findByIdAndDelete.mockRejectedValue(new Error('DB delete error'));
      await expect(userService.deleteUser(userId)).rejects.toThrow(DatabaseError);
    });
  });
});
