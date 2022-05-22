jest.mock('./packages/client/node_modules/linaria', () => ({
    css: jest.fn(() => ''),
}));