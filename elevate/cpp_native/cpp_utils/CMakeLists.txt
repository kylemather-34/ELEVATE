project(cpp_utils)

# Header only library to be shared across executables
add_library(cpp_utils INTERFACE)

target_include_directories(cpp_utils INTERFACE ${CMAKE_CURRENT_SOURCE_DIR})