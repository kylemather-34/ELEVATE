#include <iostream>
#include <fstream>
#include <string>

int main(int argc, char* argv[]) {
    // Check if a filename was provided
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <input_file\n";
        return 1;
    }

    std::string inputFile = argv[1];

    // Open the text file
    std::ifstream file(inputFile);
    if (!file.is_open()) {
        std::cerr << "Error: Could not open file " << inputFile << "\n";
    }

}