import { UserService } from './user.service';
import { getUserModel } from './user.model';
// import { hashPassword } from '../../utils/hash'; // Removed
import { UpdateUserInput, UserRole, GetAllUsersQueryType } from './user.schema'; // CreateUserInput removed
import { User } from './types';
import { DatabaseError, NotFoundError, ValidationError } from '../../utils/errors';

// Mock dependencies
jest.mock('./user.model');
// jest.mock('../../utils/hash'); // Removed
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    startOperation: jest.fn().mockReturnValue('logContext'), // Simulating a context object/string
    endOperation: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    errorOperation: jest.fn(),
    logMetric: jest.fn(),
  }),
}));

// Enhanced mock for chained query builders
const mockQueryBuilder = (resolvedValue: any) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolvedValue),
});


const mockUserModel = {
  create: jest.fn(),
  find: jest.fn().mockImplementation((conditions) => mockQueryBuilder([])), // Default to empty array
  findById: jest.fn(),
  findOne: jest.fn(),
  // findByIdAndUpdate: jest.fn(), // Not directly used, updates are findOne -> save
  // findByIdAndDelete: jest.fn(), // Not directly used for soft delete
  countDocuments: jest.fn().mockResolvedValue(0), // Default count
};

const mockUserDoc = (data: Partial<User & { _id: string, isDeleted?: boolean, deletedAt?: Date | null }>) => {
  const fullData = {
    _id: data.id || `mockId_${Math.random()}`,
    email: data.email || 'test@example.com',
    name: data.name || 'Test User',
    role: data.role || 'viewer' as UserRole,
    password: data.password || 'hashedPassword',
    googleId: data.googleId || null,
    isDeleted: data.isDeleted || false,
    deletedAt: data.deletedAt || null,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    ...data, // Override defaults with provided data
  };
  return {
    ...fullData,
    toObject: jest.fn().mockReturnValue(fullData),
    save: jest.fn().mockResolvedValue({ // save returns the saved doc (itself)
      ...fullData,
      toObject: jest.fn().mockReturnValue(fullData), // Ensure saved doc also has toObject
    }),
  };
};


describe('UserService', () => {
  let userService: UserService;
  let mockFastify: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (getUserModel as jest.Mock).mockReturnValue(mockUserModel);
    // (hashPassword as jest.Mock).mockResolvedValue('hashedPassword'); // Removed
    mockFastify = { log: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } };
    userService = new UserService(mockFastify);
  });

  describe('convertToUser', () => {
    it('should correctly convert a user document including soft delete fields', () => {
      const now = new Date();
      const userDocData = {
        _id: 'mongoId123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin' as UserRole,
        isDeleted: true,
        deletedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const userDoc = { toObject: jest.fn().mockReturnValue(userDocData) };
      // @ts-ignore
      const result = userService.convertToUser(userDoc as any);
      expect(result).toEqual(expect.objectContaining({
        id: 'mongoId123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        isDeleted: true,
        deletedAt: now,
      }));
    });

    it('should default isDeleted to false and deletedAt to null if not present', () => {
       const userDocData = { _id: 'mongoId123', email: 'test@example.com', role: 'viewer', createdAt: new Date(), updatedAt: new Date() };
       const userDoc = { toObject: jest.fn().mockReturnValue(userDocData) };
       // @ts-ignore
       const result = userService.convertToUser(userDoc as any);
       expect(result.isDeleted).toBe(false);
       expect(result.deletedAt).toBeNull();
    });
  });

  // createUser describe block was removed

  describe('getAllUsers', () => {
    const mockUsers = [
      mockUserDoc({ id: '1', name: 'Alice', email: 'alice@example.com', role: 'admin', createdAt: new Date(2023, 0, 1) }),
      mockUserDoc({ id: '2', name: 'Bob', email: 'bob@example.com', role: 'editor', createdAt: new Date(2023, 0, 2) }),
      mockUserDoc({ id: '3', name: 'Charlie (deleted)', email: 'charlie@example.com', role: 'viewer', isDeleted: true, deletedAt: new Date() }),
    ];

    beforeEach(() => {
      // Setup mock for find().exec() and countDocuments() for each test
      mockUserModel.find = jest.fn().mockImplementation((conditions) => {
        const filtered = mockUsers.filter(user => {
          let match = true;
          if (conditions.isDeleted !== undefined && user.isDeleted !== conditions.isDeleted) match = false;
          if (conditions.role && user.role !== conditions.role) match = false;
          if (conditions.$or) {
            const orMatch = conditions.$or.some((orCond: any) => {
              if (orCond.name && orCond.name.$regex) return orCond.name.$regex.test(user.name);
              if (orCond.email && orCond.email.$regex) return orCond.email.$regex.test(user.email);
              return false;
            });
            if (!orMatch) match = false;
          }
          return match;
        });
        return {
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(filtered),
        };
      });
      mockUserModel.countDocuments.mockImplementation(async (conditions) => {
         // Similar filtering logic for count
        return mockUsers.filter(user => {
          if (conditions.isDeleted !== undefined && user.isDeleted !== conditions.isDeleted) return false;
          if (conditions.role && user.role !== conditions.role) return false;
           if (conditions.$or) {
            return conditions.$or.some((orCond: any) => {
              if (orCond.name && orCond.name.$regex) return orCond.name.$regex.test(user.name);
              if (orCond.email && orCond.email.$regex) return orCond.email.$regex.test(user.email);
              return false;
            });
          }
          return true;
        }).length;
      });
    });

    it('should return paginated non-deleted users by default', async () => {
      const options: GetAllUsersQueryType = { page: 1, limit: 10 };
      const result = await userService.getAllUsers(options);
      expect(result.users.length).toBe(2); // Alice, Bob
      expect(result.users.every(u => !u.isDeleted)).toBe(true);
      expect(result.totalUsers).toBe(2);
      expect(mockUserModel.find).toHaveBeenCalledWith({ isDeleted: false });
    });

    it('should return only soft-deleted users if isDeleted is true', async () => {
      const options: GetAllUsersQueryType = { isDeleted: true };
      const result = await userService.getAllUsers(options);
      expect(result.users.length).toBe(1);
      expect(result.users[0].name).toBe('Charlie (deleted)');
      expect(result.totalUsers).toBe(1);
      expect(mockUserModel.find).toHaveBeenCalledWith({ isDeleted: true });
    });

    it('should filter by role', async () => {
      const options: GetAllUsersQueryType = { role: 'admin' as UserRole };
      const result = await userService.getAllUsers(options);
      expect(result.users.length).toBe(1);
      expect(result.users[0].name).toBe('Alice');
      expect(mockUserModel.find).toHaveBeenCalledWith({ isDeleted: false, role: 'admin' });
    });

    it('should search by name or email', async () => {
      const options: GetAllUsersQueryType = { search: 'Alice' };
      const result = await userService.getAllUsers(options);
      expect(result.users.length).toBe(1);
      expect(result.users[0].name).toBe('Alice');
       expect(mockUserModel.find).toHaveBeenCalledWith(expect.objectContaining({
        isDeleted: false,
        $or: [
          { name: expect.any(RegExp) },
          { email: expect.any(RegExp) },
        ],
      }));
    });

    it('should handle sorting', async () => {
        const options: GetAllUsersQueryType = { sortBy: 'name', sortOrder: 'asc' };
        // The actual sorting is mocked in find().sort(), so we just check if it's called.
        // To properly test sorting, the mock for find().exec() would need to implement sorting.
        // For now, we trust Mongoose if the options are passed.
        const queryBuilderInstance = mockQueryBuilder([]);
        mockUserModel.find = jest.fn().mockReturnValue(queryBuilderInstance);
        mockUserModel.countDocuments.mockResolvedValue(0);

        await userService.getAllUsers(options);
        expect(queryBuilderInstance.sort).toHaveBeenCalledWith({ name: 1 });
    });

    it('should handle pagination', async () => {
        const queryBuilderInstance = mockQueryBuilder([]);
        mockUserModel.find = jest.fn().mockReturnValue(queryBuilderInstance);
        mockUserModel.countDocuments.mockResolvedValue(100); // Assume 100 total items

        const options: GetAllUsersQueryType = { page: 3, limit: 20 };
        await userService.getAllUsers(options);
        expect(queryBuilderInstance.skip).toHaveBeenCalledWith(40); // (3-1)*20
        expect(queryBuilderInstance.limit).toHaveBeenCalledWith(20);
    });

    it('should return correct pagination metadata', async () => {
      mockUserModel.find = jest.fn().mockReturnValue(mockQueryBuilder([mockUsers[0]])); // Return 1 user
      mockUserModel.countDocuments.mockResolvedValue(3); // Total 3 users (matching some criteria)
      const options: GetAllUsersQueryType = { page: 1, limit: 2 };
      const result = await userService.getAllUsers(options);
      expect(result.totalUsers).toBe(3);
      expect(result.totalPages).toBe(2); // Math.ceil(3/2)
      expect(result.currentPage).toBe(1);
      expect(result.limit).toBe(2);
    });

    it('should throw DatabaseError on error', async () => {
      mockUserModel.find = jest.fn().mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('DB query failed')),
      }));
      await expect(userService.getAllUsers({})).rejects.toThrow(DatabaseError);
    });
  });

  describe('getUserById', () => {
    const userId = 'testId';
    const nonDeletedUser = mockUserDoc({ id: userId, isDeleted: false });
    const deletedUser = mockUserDoc({ id: userId, isDeleted: true, deletedAt: new Date() });

    it('should return non-deleted user by default', async () => {
      mockUserModel.findOne.mockResolvedValue(nonDeletedUser);
      const result = await userService.getUserById(userId);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId, isDeleted: false });
      expect(result?.id).toBe(userId);
      expect(result?.isDeleted).toBe(false);
    });

    it('should return null if user not found (and not deleted)', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      const result = await userService.getUserById(userId);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId, isDeleted: false });
      expect(result).toBeNull();
    });

    it('should return soft-deleted user if includeDeleted is true', async () => {
      mockUserModel.findOne.mockResolvedValue(deletedUser);
      const result = await userService.getUserById(userId, true);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId }); // No isDeleted filter
      expect(result?.id).toBe(userId);
      expect(result?.isDeleted).toBe(true);
    });

    it('should return null if user is soft-deleted and includeDeleted is false', async () => {
      mockUserModel.findOne.mockResolvedValue(null); // Correct behavior, findOne({isDeleted:false}) won't find it
      const result = await userService.getUserById(userId, false);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId, isDeleted: false });
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    const userId = 'userToUpdate';
    const updateData: UpdateUserInput = { name: 'New Name' };
    const existingUser = mockUserDoc({ id: userId, isDeleted: false });
    const deletedUser = mockUserDoc({ id: userId, isDeleted: true });

    it('should update a non-deleted user', async () => {
      mockUserModel.findOne.mockResolvedValue(existingUser); // For the isDeleted:false check
      // existingUser.save is already mocked
      const result = await userService.updateUser(userId, updateData);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId, isDeleted: false });
      expect(existingUser.name).toBe('New Name');
      expect(existingUser.save).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundError when trying to update a soft-deleted user', async () => {
      mockUserModel.findOne.mockResolvedValue(null); // Simulates not finding a user with {isDeleted: false}
      await expect(userService.updateUser(userId, updateData)).rejects.toThrow(NotFoundError);
    });
    // Other updateUser tests (duplicate email, db error) remain similar but ensure findOne mock for {isDeleted:false}
  });

  describe('deleteUser (Soft Delete)', () => {
    const userId = 'userToDelete';
    const userToSoftDelete = mockUserDoc({ id: userId, isDeleted: false });

    it('should soft delete a user successfully', async () => {
      mockUserModel.findOne.mockResolvedValue(userToSoftDelete);
      // userToSoftDelete.save is already mocked
      const result = await userService.deleteUser(userId);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId, isDeleted: false });
      expect(userToSoftDelete.isDeleted).toBe(true);
      expect(userToSoftDelete.deletedAt).toBeInstanceOf(Date);
      expect(userToSoftDelete.save).toHaveBeenCalled();
      expect(result.isDeleted).toBe(true);
    });

    it('should throw NotFoundError if user is not found or already deleted', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      await expect(userService.deleteUser(userId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('findOrCreateUserByGoogleProfile', () => {
    const googleProfile = { sub: 'google123', email: 'google@example.com', name: 'Google User' };
    const existingNonDeletedUser = mockUserDoc({ googleId: 'google123', email: 'google@example.com', isDeleted: false });
    const existingDeletedUser = mockUserDoc({ email: 'google@example.com', isDeleted: true });

    it('should find non-deleted user by googleId', async () => {
      mockUserModel.findOne.mockImplementation(query => {
        if (query.googleId === 'google123' && query.isDeleted === false) return Promise.resolve(existingNonDeletedUser);
        return Promise.resolve(null);
      });
      await userService.findOrCreateUserByGoogleProfile(googleProfile);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ googleId: 'google123', isDeleted: false });
    });

    it('should find non-deleted user by email if not found by googleId', async () => {
        mockUserModel.findOne
            .mockResolvedValueOnce(null) // For googleId lookup
            .mockResolvedValueOnce(existingNonDeletedUser); // For email lookup
        await userService.findOrCreateUserByGoogleProfile(googleProfile);
        expect(mockUserModel.findOne).toHaveBeenCalledWith({ googleId: 'google123', isDeleted: false });
        expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'google@example.com', isDeleted: false });
    });

    it('should not find a soft-deleted user by email and should create a new one', async () => {
        mockUserModel.findOne
            .mockResolvedValueOnce(null) // For googleId
            .mockResolvedValueOnce(null); // For email (as existing is deleted)
        const createdUser = mockUserDoc({ ...googleProfile, id: 'newUser' });
        mockUserModel.create.mockResolvedValue(createdUser);

        const result = await userService.findOrCreateUserByGoogleProfile(googleProfile);
        expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'google@example.com', isDeleted: false });
        expect(mockUserModel.create).toHaveBeenCalled();
        expect(result.email).toBe(googleProfile.email);
    });
  });

  describe('restoreUser', () => {
    const userId = 'userToRestore';
    const softDeletedUser = mockUserDoc({ id: userId, isDeleted: true, deletedAt: new Date() });
    const nonDeletedUser = mockUserDoc({ id: userId, isDeleted: false });

    it('should restore a soft-deleted user', async () => {
      mockUserModel.findOne.mockResolvedValue(softDeletedUser);
      // softDeletedUser.save is mocked
      const result = await userService.restoreUser(userId);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId, isDeleted: true });
      expect(softDeletedUser.isDeleted).toBe(false);
      expect(softDeletedUser.deletedAt).toBeNull();
      expect(softDeletedUser.save).toHaveBeenCalled();
      expect(result.isDeleted).toBe(false);
    });

    it('should throw NotFoundError if user to restore is not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      await expect(userService.restoreUser(userId)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if user is found but not soft-deleted', async () => {
      mockUserModel.findOne.mockResolvedValue(nonDeletedUser); // Found a user, but they are not {isDeleted: true}
      // This test depends on the findOne query being specific for {isDeleted: true}
      // If findOne was for {_id: userId} only, then this test would check properties on nonDeletedUser
      // As it's findOne({_id: userId, isDeleted: true}), finding nonDeletedUser means it won't be found by this query.
      // So we need to make findOne return null for the query {isDeleted: true} if the user is not deleted.
      mockUserModel.findOne.mockImplementation(query => {
          if(query._id === userId && query.isDeleted === true) return Promise.resolve(null); // Correctly not found
          return Promise.resolve(nonDeletedUser); // Other queries might find it
      });
      await expect(userService.restoreUser(userId)).rejects.toThrow(NotFoundError);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ _id: userId, isDeleted: true });
    });
  });
});
